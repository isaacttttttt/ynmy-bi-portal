# r10 升级与部署说明

本版（`ynmy-bi-portal:customer-20261120-r10`）包含以下功能升级与性能优化：

1. **专题分析重构（基于角色目录映射）**：
   - 新增独立功能页 `/portal/role-thematic-config/`，支持管理员为自己有权限管理的角色配置专属的“目录 → 报表”树形结构、拖拽/上下排序、重命名与角色访问权限开关（不集成到门户首页，由帆软主平台权限独立挂载）。
   - 门户首页左下角 **专题分析** 数据源切换为 `dim_bi_user.role_id`（支持 JSON 数组字符串格式 `["role-1","role-2"]`）→ 映射表 `portal_role_thematic_config` / `portal_role_thematic_node`，支持多角色账号在标题栏与**面包屑**中直接切换角色并逐级下钻目录。
2. **数据字典与工作台性能优化**：
   - 数据字典累计访问量（`views`）及访问量级筛选直接读取 `dim_bi_report_info_dtl.report_total_views`，不再聚合扫描 `dim_bi_visit_log`；搜索下拉跳过 `dim_bi_visit_log`；工作台日志查询下推 `user_code` 仅扫描当前用户。
3. **全链路缓存优化（方案 A）**：
   - 按路由按需加载帆软 `/v10/view/entry/tree`（公告、搜索历史及角色配置页不再拉取 `tree`），未配置 `FINE_ROOT_ID` 时自动瘦身跳过平台 `folder` 节点并预建 `entryMap`。
   - 合并 `dim_bi_user` 单次查询并增加会话身份缓存、`/v10/roles` 分页缓存、按 `role_id` 跨用户共享的专题目录树缓存（保存配置时立即失效）以及 T+1 公共字典/目录元数据共享缓存。
4. **布局交互简化**：
   - 移除顶部“显示模式”切换按钮，门户首页与报表字典页固定默认使用**双向自适应**布局。

---

## 1. 数据库准备（DBA 执行）

升级容器前，请 DBA 在门户连接的 PostgreSQL 主库执行交付包内的 `sql/007-role-thematic-mapping.sql`：

```bash
psql -h 数据库主机 -p 数据库端口 -U 数据库管理员 -d finedb_ext -v ON_ERROR_STOP=1 -f sql/007-role-thematic-mapping.sql
```

执行前后请确认以下 4 项：

1. **新建角色映射表**（门户读写）：
   - `public.portal_role_thematic_config`
   - `public.portal_role_thematic_node`
2. **角色-报表可配置底表**（ETL 维护，门户只读）：
   - `public.dim_bi_role_report_rel`（含 `role_id`、`role_name`、`report_id`、`report_name`；如正式表名不同，可在 `conf/portal.env` 通过 `DB_ROLE_REPORT_TABLE` 指定）。
3. **现有底表字段确认**：
   - `public.dim_bi_report_info_dtl` 已包含 `report_total_views` 字段。
   - `public.dim_bi_user` 已包含 `role_id` 字段（支持 `["id1","id2"]` JSON 数组字符串格式）。
4. **账号授权与推荐索引**（将 `portal_reader` 替换为实际运行账号）：

```sql
GRANT SELECT ON public.dim_bi_role_report_rel TO portal_reader;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.portal_role_thematic_config, public.portal_role_thematic_node
  TO portal_reader;

-- 推荐补充：配合工作台按 user_code 过滤访问日志，加速最近打开 / 我常用的
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_visit_user_report_day
  ON public.dim_bi_visit_log (user_code, report_id, day_id);
```

---

## 2. 在原部署目录升级容器

将交付包中的 `ynmy-bi-portal-customer-20261120-r10-linux-amd64.tar` 及对应的 `.tar.sha256` 放到原部署目录。保留原有的 `conf/portal.env`、`logs/` 目录、端口映射与 Nginx 配置。

### 2.1 校验并导入镜像

```bash
sha256sum -c ynmy-bi-portal-customer-20261120-r10-linux-amd64.tar.sha256
docker load -i ynmy-bi-portal-customer-20261120-r10-linux-amd64.tar
```

### 2.2 检查 `conf/portal.env` 配置

原有数据库、平台接口与日志配置保持不变，确认或按需补充以下配置项（未填写时均使用括号内默认值）：

```dotenv
PUBLIC_ORIGIN=https://bi.ynby.cn
PORTAL_LOG_FILE=/app/logs/portal.log

# 角色配置页调用的帆软角色接口（默认值与线上一致）
FINE_ROLES_PATH=/v10/roles
FINE_ROLES_PRIVILEGE_TYPE=2

# 角色-报表可配置底表名（如 DBA 使用自定义表名则修改此项）
DB_ROLE_REPORT_TABLE=dim_bi_role_report_rel

# 可选缓存 TTL（秒，均默认 60；设为 0 可关闭对应持久缓存）
FINE_TREE_CACHE_TTL_SECONDS=60
FINE_IDENTITY_CACHE_TTL_SECONDS=60
FINE_ROLES_CACHE_TTL_SECONDS=60
PORTAL_THEMATIC_CACHE_TTL_SECONDS=60
PORTAL_CATALOG_CACHE_TTL_SECONDS=60
```

> 若确认不再使用旧版目录树根节点，可将 `FINE_ROOT_ID` 留空以自动跳过平台 `folder` 节点缓存、进一步降低内存占用。

### 2.3 切换镜像并重建容器

编辑原 `compose.yaml`，将 `portal` 服务的 `image` 修改为：

```yaml
    image: ynmy-bi-portal:customer-20261120-r10
```

执行重建（使用旧版 `docker-compose` 时将 `docker compose` 替换为 `docker-compose`；**必须使用 `--force-recreate`**，单纯 `restart` 不会切换镜像）：

```bash
docker compose -f compose.yaml up -d --force-recreate portal
docker compose -f compose.yaml images
docker compose -f compose.yaml ps
```

---

## 3. 在 FineBI 平台挂载独立配置页

**Nginx 无需改动**：原 `/portal/` 前缀转发规则（`location ^~ /portal/ { proxy_pass http://10.11.8.16:3001; }`）会自动覆盖新页面与全部新接口。

在 FineBI 决策平台执行挂载：

1. 进入 **管理系统 → 目录管理**。
2. 在管理员专用目录下点击 **添加链接**（外挂网页链接），地址填写：
   ```text
   https://bi.ynby.cn/portal/role-thematic-config/
   ```
   （漏写末尾 `/` 时后端会自动 `308` 跳转补齐，但建议直接填带 `/` 的完整地址。）
3. 进入 **管理系统 → 权限管理**，仅对需要维护专题目录的管理员角色开放该目录链接的访问权限。

---

## 4. 验收检查清单

### 4.1 角色目录配置页验收（`https://bi.ynby.cn/portal/role-thematic-config/`）
1. 左侧 **角色** 列表平铺展示当前管理员有权限的角色，每页 15 条，支持翻页与关键词搜索，界面无“部门”字样。
2. 选中某个角色后，右侧可点击 **+ 新增一级目录**、**+ 新增目录**、**+ 添加报表**（弹窗展示该角色在 `dim_bi_role_report_rel` 中的可配置报表）。
3. 支持拖拽调整目录/报表顺序或移入其他目录、上下按钮微调排序、铅笔图标内联重命名、目录三态（可访问 / 部分开放 / 不可访问）与报表访问权限开关，页面底部无“预览”按钮。
4. 点击 **保存** 后，确认 Network 中 `POST /portal/api/portal/v1/role-thematic/roles/:roleId/tree` 返回 `200`，刷新页面后配置持久化保留。

### 4.2 门户首页与数据字典验收（`https://bi.ynby.cn/portal/`）
1. 顶部不再显示“显示模式”切换按钮，首页与报表字典页均固定为双向自适应展示。
2. 左下角 **专题分析** 读取当前用户 `dim_bi_user.role_id` 对应的角色配置树；多角色账号可在标题栏下拉及**面包屑**中自由切换角色，点击文件夹逐级下钻，点击报表正常在帆软页签中打开。
3. 进入 **报表字典**，核对累计访问量展示 `dim_bi_report_info_dtl.report_total_views` 数值，切换访问量级筛选（高/中/低频）与翻页响应流畅。

### 4.3 日志与缓存观测

```bash
# 查看实时请求日志
tail -n 200 -f logs/portal.log

# 排查失败请求
grep '"msg":"request failed"' logs/portal.log | tail -20

# 查看各类缓存命中情况（hit / shared / miss / stored）
grep -E '"stage":"(tree-cache|identity-cache|roles-cache|thematic-cache|catalog-cache)"' logs/portal.log | tail -30
```

---

## 5. 回退方案

如需回退至上一版本（`r9`）：

1. 将 `compose.yaml` 中的 `image` 改回 `ynmy-bi-portal:customer-20261116-r9`。
2. 执行 `docker compose -f compose.yaml up -d --force-recreate portal`。
3. 新增表 `portal_role_thematic_config`、`portal_role_thematic_node` 及 `dim_bi_role_report_rel` 无需删除，不影响旧版运行。
