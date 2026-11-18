-- PostgreSQL 13+；在门户实际连接的可写主库执行。
-- 使用表所有者或 DBA 账号，开启自动提交，禁止放在 BEGIN/COMMIT 中。
-- 沿用 004 的索引名称；IF NOT EXISTS 仅按名称跳过已有索引。

-- 登录用户定位与公告用户部门查询。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_user_id
  ON public.dim_bi_user (id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_user_username
  ON public.dim_bi_user (username);

-- 两种报表查询都通过 report_id 关联目录与字典；字典 id 主键不能替代此索引。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_report_id
  ON public.dim_bi_report_info_dtl (report_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_dictionary_report_id
  ON public.dim_bi_report_dictionary (report_id);

-- 当前 SQL 先按报表和日期范围取日志，再聚合总访问量与用户近30天访问量。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_visit_report_day
  ON public.dim_bi_visit_log (report_id, day_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_visit_day
  ON public.dim_bi_visit_log (day_id DESC);

-- 实际 JOIN 使用 trim(dept_job_id)，普通 dept_job_id 索引不能替代此表达式索引。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_dept_job_trim
  ON public.dim_dept_mapping (trim(dept_job_id));

-- 只展示启用的快捷入口，按 sort_no、app_id 排序。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_quick_entry_enabled_sort
  ON public.fr_quick_entry_app (sort_no, app_id) WHERE status = 1;

-- 客户现有同名索引已覆盖历史查询与清理；不重复增加主键或唯一索引。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_history_recent
  ON public.portal_search_history (user_code, category, searched_at DESC, query_key);

ANALYZE public.dim_bi_user;
ANALYZE public.dim_bi_report_info_dtl;
ANALYZE public.dim_bi_report_dictionary;
ANALYZE public.dim_bi_visit_log;
ANALYZE public.dim_dept_mapping;
ANALYZE public.fr_quick_entry_app;
ANALYZE public.portal_search_history;

-- indisvalid / indisready 均应为 true；中断的并发建索引可能留下无效同名索引。
SELECT t.relname AS table_name, i.relname AS index_name,
       x.indisvalid, x.indisready, pg_get_indexdef(i.oid) AS definition
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname IN (
  'dim_bi_user', 'dim_bi_report_info_dtl', 'dim_bi_report_dictionary',
  'dim_bi_visit_log', 'dim_dept_mapping', 'fr_quick_entry_app', 'portal_search_history')
ORDER BY t.relname, i.relname;
