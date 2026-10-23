# 后端与 Railway 测试交接

本轮部署使用示例数据，不启动本地 PoC。正式接入时保留门户 API，替换底表数据与帆软会话适配。

## 服务边界

| 服务 | 入口 | 职责 |
| --- | --- | --- |
| portal | https://portal-production-c6e5.up.railway.app/poc/ | Fastify 5 提供静态前端、`/api/portal/v1` 和测试平台代理 |
| platform-simulator | Railway 内网，3002 | 模拟会话、授权目录、收藏和预览；数据写入 MySQL |
| MySQL | Railway 内网，3306 | 持久化业务示例底表和模拟平台状态，挂载数据卷 |

项目 `ynmy-bi-portal-test`，ID `a24b6b09-9196-42c2-b5ed-3a8b8d2b437a`。Railway 默认环境名称为 `production`，实际用途是测试。三个服务均在此独立项目内。仅 portal 有公网域名；MySQL 无公网 TCP 代理。

访问码保存在本机 `artifacts/qa/Railway测试访问码.txt`。测试台提供综合、临床受限、无目录权限三种账号。登录后以 HttpOnly、Secure、SameSite=Lax Cookie 建立会话，8 小时到期；数据库只保存会话令牌哈希。访问码不进入前端构建、Git 或日志。

## 运行与部署

运行时 Node.js 24。根 `Dockerfile` 构建 `NEXT_PUBLIC_PORTAL_MODE=api` 的静态页面，再由后端提供服务。`backend/poc/Dockerfile` 构建模拟平台。

Railway 服务配置：

| 配置 | portal | platform-simulator |
| --- | --- | --- |
| Dockerfile | `Dockerfile` | `backend/poc/Dockerfile` |
| 预部署 | 无 | `node backend/poc/seed.js` |
| 启动 | `node backend/src/server.js` | `node backend/poc/platform.js` |
| 健康检查 | `/health` | `/health` |
| 端口 | 3001 | 3002 |

配置直接保存在 Railway 服务设置中，不依赖已弃用的 `railway.json`。服务监听 IPv6，以支持 Railway 内网。两者共用同一代码仓库的 `codex/backend-railway-test` 分支。

后端变量模板见 `backend/.env.example`。Railway 的数据库地址、端口、库名使用 `${{MySQL.MYSQLHOST}}` 等引用。portal 使用只读账号 `portal_reader`；模拟平台运行时使用 `portal_platform`，仅能读写 `poc_*` 表。模拟平台预部署脚本使用 MySQL 管理员建表、初始化和授权；此管理员变量不提供给 portal。

`FINE_BASE_URL` 指向模拟平台内网 `/webroot/decision`；`FINE_SESSION_PATH=/poc/session`。`POC_PLATFORM_URL` 仅在测试环境设置，启用 `/poc/*` 代理。正式环境应移除此变量和模拟平台服务。

种子脚本按 `portal_data_batch` 标记只初始化一次。重复部署不会清空收藏、会话或权限；现有库不会自动迁移旧表结构。未来底表结构变更须增加明确的迁移脚本。

## 权限与数据链路

每次 API 请求从 Cookie 读取会话，通过平台身份接口取得可信用户名，再用该用户会话请求完整授权 tree。tree 失败、结构不合法或会话失效均拒绝请求，不使用管理员目录回退。接口不接受客户端 `userId`。

报表底表先与授权入口 ID 取交集，再做搜索、筛选计数和分页。公告根据完整授权树精确匹配逗号分隔 ID，并校验上海日期的生效范围；专题只返回指定根目录的授权子树。收藏通过帆软接口写入，支持幂等添加/取消；报表无权时不暴露详情。

前端工作台仍使用当前会话缓存，Tab 切换不请求接口，每 10 分钟静默刷新。新请求立即执行服务端权限检查；旧页面中已缓存的标题可能保留到刷新，打开报表时由平台再次鉴权。

## 底表交接

业务 DDL：`backend/sql/001-portal.sql`；模拟平台 DDL：`backend/sql/002-platform-poc.sql`。`poc_*` 表不属于正式业务模型。

- `report_metadata.fine_entry_id` 与 tree 的入口 ID 关联，`report_id` 仅作元数据主键。BI 的发布任务 ID 取自平台，不与前两者混用。
- Hive 日访问聚合由 ETL 同步至 MySQL `dim_bi_visit_log`。按可信 `user_code` 求 `SUM(visit_num)`；常用统计窗口为 `data_as_of` 向前 29 天，包含两端。未来日期不计入。最近访问取截至批次日期的最大访问日。
- ETL 完成一批数据后，更新 `portal_data_batch.data_as_of`。表和标记应作为同一批次交付；不得先推进标记。
- PoC 将原日期字符串规范为 DATE；原字段需在导入时转换。公告结束日当天有效，空权限范围默认不可见。
- `total_views` 为底表累计访问量；当前用户近 30 日访问量单独用于常用排序。
- 为快捷入口补充稳定 `app_key` 和删除标记。图标 URL、跳转 URL 只允许 HTTP(S) 或同源相对路径。
- 排序字段、索引和 JSON 指标数组已在 DDL 明确。暂按权限过滤后的目录规模在内存中搜索；实际目录达到数万项并出现延迟时，再将搜索和分面统计下推 SQL。

## 真实帆软接入前待确认

`FINE_SESSION_PATH` 是本项目约定的身份适配接口，**不是已验证的帆软内置接口**。平台需提供能验证当前会话并返回 `{data:{userName,name}}` 的服务，或在 `backend/src/platform.js` 中适配真实返回值。平台 token 的传递方式、Cookie 名称及过期行为需现场确认。

目录与收藏当前按 `categoryview_0521` 的 v10 调用方式适配。真实版本的字段、入口类型、发布任务 ID 和收藏成功返回值仍须对照测试环境校验。预览沿用父窗口 BI/FS 接口；测试台只验证调用链，不渲染真实业务报表。

## 验收

`npm test` 检查共享前端逻辑；`npm run type-check` 检查类型。`backend/test/poc.mjs` 对 Railway 的真实 HTTP API 执行集成检查，不启动本地服务或拦截 HTTP。访问码从 `POC_ACCESS_KEY` 环境变量或本地忽略文件读取，结果不输出令牌和密钥。

```powershell
node backend/test/poc.mjs
```

浏览器直接连接云端接口：

```powershell
$env:PLAYWRIGHT_MODULE='本机已有 playwright 模块的绝对目录'
$env:PORTAL_URL='https://portal-production-c6e5.up.railway.app'
$env:PORTAL_LIVE_POC='1'
node scripts/check-portal-ui.cjs
```

重启持久化检查：先运行 `node backend/test/poc.mjs --prepare-restart`，在 Railway 重启或重新部署 portal 与 platform-simulator，待两个服务均成功后运行 `node backend/test/poc.mjs --verify-restart`。脚本验证同一会话和新增收藏仍有效，再恢复原收藏状态；临时会话文件只写入忽略目录。

预部署脚本还会连接真实 MySQL 检查 portal_reader 能读业务表、不能写业务表或读取会话表，并用回滚事务验证公告结束日当天仍可见。示例公告有效期以首次初始化日期为准，长期复用测试库时需刷新示例日期；访问日期不会伪装成实时数据。

前端固定 Next.js 15.5.28，并将 PostCSS 统一到修复版本；依赖锁文件随代码提交。运行镜像只包含静态页面和 Fastify 后端，不运行 Next.js 开发服务器。

浏览器截图与实际验收结果保存在本机 `artifacts/qa/`。测试控制接口 `/poc/control` 同时要求测试管理员会话、访问码和同源 Origin，仅用于本测试项目的权限收回、会话过期及上游故障场景。
