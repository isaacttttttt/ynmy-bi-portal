# 门户查询索引

执行文件：`backend/sql/006-customer-query-indexes.sql`。适用于当前 source 数据模型和 PostgreSQL 13 及以上版本，无须更换镜像。

在门户连接的同一数据库执行，使用表所有者或 DBA 账号。Navicat 开启自动提交；按语句执行，不能将整份脚本包在一个事务中。使用 psql 时：

```bash
psql -h 数据库主机 -p 数据库端口 -U 数据库管理员 -d finedb_ext -v ON_ERROR_STOP=1 -f 006-customer-query-indexes.sql
```

| 查询用途 | 索引字段 |
|---|---|
| Cookie 用户 ID 对应平台用户 | dim_bi_user(id) |
| 当前 username 对应 OA 部门 | dim_bi_user(username) |
| 目录与字典关联 | 两表各自的 report_id |
| 授权报表的访问日志与日期范围 | dim_bi_visit_log(report_id, day_id) |
| 最新日志日期 MAX(day_id) | dim_bi_visit_log(day_id DESC) |
| OA 部门对应公告部门映射 | dim_dept_mapping(trim(dept_job_id)) |
| 启用快捷入口排序 | fr_quick_entry_app(sort_no, app_id)，仅 status=1 |
| 当前用户、类别的最近搜索记录 | 复用 idx_search_history_recent |

脚本复用已有 004 脚本的索引名称，客户附件中的搜索历史主键和索引无需重建。执行前如发现其他名称、相同字段顺序的等价索引，跳过相应 CREATE 语句。IF NOT EXISTS 只检查索引名称，不检查定义是否等价。脚本最后输出索引定义及有效状态，indisvalid、indisready 应均为 true。

当前报表名称、标签、指标、Owner、数据源的关键词匹配，以及所属组织 business_group 等筛选在 Node.js 内存执行，因此本次不为这些字段增加无效的查询索引。公告部门是逗号分隔字符串，现有 SQL 拆分后匹配；普通 notice_dept_name 索引无法加速该匹配。公告日期为字符串转 date，不创建依赖日期解析的表达式索引。

索引不能免除累计访问量所需的日志聚合；授权报表覆盖大部分日志时，PostgreSQL 仍可能选择顺序扫描。也不会解决日志中 25006 只读事务导致的历史写入失败，需先确认数据库连接允许写入。
