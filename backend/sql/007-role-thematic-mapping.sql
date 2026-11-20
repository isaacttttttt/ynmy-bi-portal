-- ============================================================================
-- 007-role-thematic-mapping.sql
-- 专题分析角色目录映射表 & 关联底表结构（PostgreSQL 13+）
-- ============================================================================
-- 说明：
-- 1. portal_role_thematic_config / portal_role_thematic_node 为门户自维护配置表，
--    门户运行账号（如 portal_reader）需具备 SELECT / INSERT / UPDATE / DELETE 权限。
-- 2. dim_bi_role_report_rel 为 ETL / DBA 同步维护的“角色-报表”可配置底表，
--    门户运行账号仅需 SELECT 权限。
-- 3. dim_bi_user 需包含 role_id 字段（支持单角色值、逗号分隔多角色值或一用户多行）。
-- ============================================================================

-- 1. 角色专题配置主表（每个已配置角色一行，记录角色名称及最后保存元信息）
CREATE TABLE IF NOT EXISTS public.portal_role_thematic_config (
  role_id     VARCHAR(128) NOT NULL,
  role_name   VARCHAR(256) NOT NULL,
  updated_by  VARCHAR(128) NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id)
);

COMMENT ON TABLE  public.portal_role_thematic_config            IS '专题分析-角色目录配置主表';
COMMENT ON COLUMN public.portal_role_thematic_config.role_id    IS '帆软角色ID（对应 /v10/roles 返回的 id）';
COMMENT ON COLUMN public.portal_role_thematic_config.role_name  IS '角色名称快照（用于首页角色切换展示）';
COMMENT ON COLUMN public.portal_role_thematic_config.updated_by IS '最后修改人账号（dim_bi_user.username）';
COMMENT ON COLUMN public.portal_role_thematic_config.updated_at IS '最后保存时间';

-- 2. 角色专题目录与报表节点映射表（邻接表树结构，支持任意层级目录嵌套与排序）
CREATE TABLE IF NOT EXISTS public.portal_role_thematic_node (
  node_id        VARCHAR(128) NOT NULL,
  role_id        VARCHAR(128) NOT NULL,
  parent_node_id VARCHAR(128) NULL,
  node_type      VARCHAR(16)  NOT NULL,
  report_id      VARCHAR(128) NULL,
  node_name      VARCHAR(256) NOT NULL,
  sort_no        INTEGER      NOT NULL DEFAULT 0,
  is_enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (node_id),
  CONSTRAINT fk_role_thematic_node_config
    FOREIGN KEY (role_id) REFERENCES public.portal_role_thematic_config (role_id)
    ON DELETE CASCADE,
  CONSTRAINT ck_role_thematic_node_type
    CHECK (node_type IN ('folder', 'report')),
  CONSTRAINT ck_role_thematic_node_report_binding
    CHECK (
      (node_type = 'folder' AND report_id IS NULL)
      OR
      (node_type = 'report' AND report_id IS NOT NULL AND length(trim(report_id)) > 0)
    ),
  CONSTRAINT ck_role_thematic_node_no_self_parent
    CHECK (parent_node_id IS NULL OR parent_node_id <> node_id)
);

COMMENT ON TABLE  public.portal_role_thematic_node                IS '专题分析-角色目录与报表树形映射表';
COMMENT ON COLUMN public.portal_role_thematic_node.node_id        IS '节点唯一ID（UUID）';
COMMENT ON COLUMN public.portal_role_thematic_node.role_id        IS '所属角色ID';
COMMENT ON COLUMN public.portal_role_thematic_node.parent_node_id IS '父目录节点ID；NULL 表示该角色下的顶级节点';
COMMENT ON COLUMN public.portal_role_thematic_node.node_type      IS '节点类型：folder-自定义目录，report-报表模板';
COMMENT ON COLUMN public.portal_role_thematic_node.report_id      IS '报表ID（关联 dim_bi_report_info_dtl.report_id），目录节点为空';
COMMENT ON COLUMN public.portal_role_thematic_node.node_name      IS '目录名称或报表展示名称';
COMMENT ON COLUMN public.portal_role_thematic_node.sort_no        IS '同级排序号（升序，从0开始）';
COMMENT ON COLUMN public.portal_role_thematic_node.is_enabled     IS '角色访问权限开关：true-可访问，false-不可访问';

-- 按角色与父节点有序读取整棵树
CREATE INDEX IF NOT EXISTS idx_role_thematic_node_tree
  ON public.portal_role_thematic_node (role_id, parent_node_id, sort_no, node_id);

-- 门户首页仅读取启用节点时加速过滤
CREATE INDEX IF NOT EXISTS idx_role_thematic_node_enabled
  ON public.portal_role_thematic_node (role_id, sort_no, node_id)
  WHERE is_enabled = TRUE;

-- 同一角色下同一报表只允许映射一次，避免重复配置
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_thematic_node_role_report
  ON public.portal_role_thematic_node (role_id, report_id)
  WHERE report_id IS NOT NULL;

-- ============================================================================
-- 3. 角色-报表可配置底表（由 ETL / DBA 同步维护，门户只读）
--    若正式库表名不同，可通过环境变量 DB_ROLE_REPORT_TABLE 指定，列名需保持一致。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dim_bi_role_report_rel (
  role_id     VARCHAR(128) NOT NULL,
  role_name   VARCHAR(256) NULL,
  report_id   VARCHAR(128) NOT NULL,
  report_name VARCHAR(256) NULL
);

COMMENT ON TABLE  public.dim_bi_role_report_rel             IS '角色与可配置报表关联底表（ETL同步，门户只读）';
COMMENT ON COLUMN public.dim_bi_role_report_rel.role_id     IS '角色ID（对应帆软 /v10/roles 返回的 id）';
COMMENT ON COLUMN public.dim_bi_role_report_rel.role_name   IS '角色名称';
COMMENT ON COLUMN public.dim_bi_role_report_rel.report_id   IS '报表ID（关联 dim_bi_report_info_dtl.report_id）';
COMMENT ON COLUMN public.dim_bi_role_report_rel.report_name IS '报表名称';

CREATE INDEX IF NOT EXISTS idx_portal_role_report_rel_role
  ON public.dim_bi_role_report_rel (role_id, report_id);

-- ============================================================================
-- 4. dim_bi_user.role_id 字段说明（如已有该列则无需执行）
--    支持以下任意一种存储方式：
--      a) JSON 数组字符串（客户当前格式）：'["c494004d-701e-4449-9244-cb4f9bb3c9a7","xxxx"]'
--      b) 单个角色ID或逗号分隔多个角色ID：'role-001' / 'role-001,role-002'
--      c) 同一 username 多行（每行一个或多个 role_id）
-- ============================================================================
-- ALTER TABLE public.dim_bi_user ADD COLUMN IF NOT EXISTS role_id VARCHAR(2048);

-- ============================================================================
-- 5. 门户运行账号授权示例（请替换为实际数据库名和运行账号）
-- ============================================================================
-- GRANT SELECT ON public.dim_bi_role_report_rel TO portal_reader;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_role_thematic_config, public.portal_role_thematic_node TO portal_reader;
