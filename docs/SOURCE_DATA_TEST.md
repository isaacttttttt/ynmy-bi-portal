# 2026-11-05 底表导入与接口验证

已将用户提供的 `public.sql` 全量导入 Railway `ynmy-bi-portal-test` 项目现有 Postgres 服务中的独立数据库 `portal_realdata_20261105`。原示例库保留，生产数据库未连接、未写入。原始数据和连接凭据不进入 Git。

## 导入核对

导入使用事务，提交前逐表核对源文件 INSERT 数与数据库行数，全部一致。

| 表 | 行数 |
|---|---:|
| dim_bi_report_info_dtl | 2,076 |
| dim_bi_user | 12,433 |
| dim_bi_visit_log | 683,628 |
| dim_dept_mapping | 1,522 |
| fr_index_noticement | 5 |
| fr_quick_entry_app | 2 |
| icon_repository | 4 |
| portal_search_history | 0 |
| report_lifecycle | 100 |
| 合计 | 699,770 |

访问日志覆盖 2024-06-01 至 2026-11-05，日期均为 YYYY-MM-DD，访问次数均为非负整数字符串；visit_type 全部为空，当前按提供的 visit_num 汇总，不额外按访问类型筛选。

## 已确认的数据处理

公告权限：可信登录用户名匹配 `dim_bi_user.username`，只接受 `enable='true'`；以 `oa_dept_code = dim_dept_mapping.dept_job_id` 获取 `dept_name`，与公告 `notice_dept_name` 的逗号分隔列表逐项精确匹配。未匹配用户、停用用户、无部门映射及其他部门均不可见，不用报表目录权限替代公告部门权限。

5 条公告原始日期倒置。经用户确认，仅在测试库交换起止日期：起始为 2026-11-02 或 2026-11-04，截止为 2026-11-30。原 SQL 未修改。附件链接通过接口返回，前端详情增加附件入口；未验证企业附件服务器的登录及下载权限。

100 条 report_lifecycle 记录缺少 report_id，且与目录表的开发路径、名称均无精确匹配。按用户确认暂不关联。简介、Owner、组织、标签、指标、更新频率等缺少可信来源的字段返回空值；报表生命周期状态也尚未联通，当前可用状态依据传入的平台目录，不能据此认定生命周期记录已上线或已归档。

2 个快捷入口 status 均为 0，接口正确返回空列表；1,426 名启用用户无 OA 部门映射，公告权限默认拒绝。上述数据未自动补齐或启用。

## 验证结果及边界

- 56 次真实 Fastify 接口调用通过，SQL 实际访问 Railway 测试 PG；2,076 条报表逐页检查，无丢失、无重复。
- 覆盖搜索四种分类、工作台三个 Tab、报表权限过滤、平台目录排除、公告部门授权/拒绝、停用用户、无映射用户、过期公告、附件返回及四类搜索历史的写入/读取/清空。
- 权限负例与搜索历史测试在事务中执行，结束后回滚，不保留测试修改。
- 现有 `npm test`、`npm run type-check`、`npm run build` 通过。
- 身份与目录服务使用受控替身。此次不是实际帆软登录、收藏、打开报表和嵌入页面的端到端验收；真实平台联调仍需相应测试环境。
- 现有 Railway 门户尚未切换到真实数据模型，本次新增的是独立数据库及已验证的源码适配。

## 使用方式

真实底表模式设置 `PORTAL_DATA_MODEL=source`，`DB_*` 指向上述独立库；默认 `demo` 模式仍兼容原示例库。先导入提供的原表，再执行 `backend/sql/004-source-indexes.sql`。不要在该库执行 `001-portal.sql` 来替换同名原始表。

复测：设置 `SOURCE_TEST_DATABASE_URL` 为独立测试库连接串，执行 `node backend/test/source.mjs`。测试连接需要在事务中更新权限负例数据，仅用于测试库，不使用生产库连接。

本地导入核对、数据审计和接口日志保存在忽略目录 `artifacts/qa/` 中。导入脚本为本次数据快照的一次性工具，不作为生产数据同步任务。
