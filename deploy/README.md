# 客户环境 Docker 部署

适用架构：Linux x86_64 / amd64。镜像包含门户前端和后端，不包含数据库、企业底表数据或模拟登录服务。

## 1. 导入镜像、填写配置

在本文件所在目录执行：

```bash
docker load -i ynmy-bi-portal-customer-20261112-r7-linux-amd64.tar
cp conf/portal.env.example conf/portal.env
vi conf/portal.env
mkdir -p logs
sudo chown 1000:1000 logs conf/portal.env
sudo chmod 750 logs
sudo chmod 600 conf/portal.env
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail=100 portal
tail -f logs/portal.log
```

交付包如已包含 `conf/portal.env`，直接编辑，不必再次复制。配置文件含密码，建议限制读取权限；容器以 node 用户（UID 1000）运行，挂载文件必须允许该用户读取，例如设置文件所有者为 1000，权限为 600。

配置通过 `./conf:/app/config:ro` 只读挂载，应用启动时读取 `/app/config/portal.env`。Docker 环境变量优先于文件中的同名配置。配置不会写入镜像，也不会整份返回浏览器。

修改挂载文件后执行 `docker compose -f compose.yaml restart portal`。如果改的是 Compose 环境变量或端口，执行 `docker compose -f compose.yaml up -d --force-recreate portal`。无需重新构建镜像。

默认端口为 3001。可用 `PORTAL_HTTP_PORT=8081 docker compose -f compose.yaml up -d` 修改宿主机端口，容器内部仍使用 3001。

不使用 Compose 时，也可用 `docker run -d --name bi-portal --restart unless-stopped -p 3001:3001 --env-file ./conf/portal.env -v "$PWD/logs:/app/logs" ynmy-bi-portal:customer-20261112-r7`。这种方式把文件转为容器环境变量，改文件后需要删除并重新创建该容器，单纯 restart 不会重新读取 env-file。

## 2. 必填项与平台接口

| 配置 | 用途 |
|---|---|
| `PUBLIC_ORIGIN` | 浏览器访问平台的源，例如 `https://bi.customer.example`；不带路径 |
| `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` | 容器可访问的 PostgreSQL 地址与账号；不要把宿主机数据库写成容器内的 localhost |
| `FINE_BASE_URL` | 后端请求帆软的平台根地址，例如 `http://finebi.internal:8080/WebReport/ReportServer` |
| `FINE_IDENTITY_MODE` | 交付配置为 `trusted-cookie`，按客户主平台校验后的 Cookie 映射身份；也保留 `session` 模式 |
| `FINE_USER_COOKIE_NAME` | 默认 `fine_login_users`，其值对应 `dim_bi_user.id` |
| `FINE_SESSION_PATH` | 仅 `session` 模式使用；`trusted-cookie` 模式无需填写 |
| `FINE_TREE_PATH` | 当前用户有权限的目录列表 |
| `FINE_FAVORITES_PATH` | 当前用户的收藏列表 |
| `FINE_FAVORITE_ADD_PATH/METHOD` | 添加收藏；路径中的 `{entryId}` 自动替换 |
| `FINE_FAVORITE_REMOVE_PATH/METHOD` | 取消收藏；默认 POST 加 `?fakeMethod=DELETE`，也可配置 DELETE |
| `FINE_ROOT_ID` | 专题分析的置顶根目录 ID，不用于替代用户权限 |
| `FINE_COOKIE_NAME` | 登录 token Cookie 名，默认 `fine_auth_token` |
| `FINE_BROWSER_BASE_URL` | 浏览器侧平台路径，例如 `/WebReport/ReportServer`；不要填写 Docker 内网服务名 |
| `FINE_ENTRY_ACCESS_PATH` | CPT / FRM / FVS 打开路径模板；复用父页面 `FS.tabPane.addItem` |
| `FINE_BI_SERVICE_NAME/FINE_BI_TAB_TYPE` | BI 打开桥接参数，默认与参考项目一致 |
| `FINE_ICON_URL_TEMPLATE` | 可选指定图标，例如 `/files/imgs/{entryId}.png`；本地图标先显示，远程图标按可视区域加载 |

后端接口路径以 `/` 开头时，追加到 `FINE_BASE_URL` 后面；也可以填写完整 HTTP(S) 地址。不要在地址中嵌入用户名、密码或固定用户 token。后端会把当前登录 token 作为 `Authorization: Bearer ...` 转发到配置的接口，因此这些地址必须属于客户可信平台。

本客户采用 `fine_login_users → dim_bi_user.id → username`。Cookie 可包含逗号分隔的多个历史用户 ID：多用户时读取当前 token 的 `sub`，在 ID 列表中匹配 `dim_bi_user.username`，不会默认选择第一个。token 的校验仍由主平台承担。仅接受启用（`enable='true'`）且唯一匹配的用户。访问日志关联明确为 `dim_bi_visit_log.user_code = dim_bi_user.username`；公告权限、搜索历史也使用 username。目录、收藏继续用 `fine_auth_token` 调用平台。

快捷入口直接读取 `fr_quick_entry_app.icon_url`，先显示本地图标，再懒加载该 URL；失败保留本地图标。`icon_repository` 是填报侧维护图标的来源，门户无需拼接固定路径。`FINE_ICON_URL_TEMPLATE` 仅作为报表卡片的可选图标模板，与快捷入口图标无关。

### 目录缓存

默认配置如下，修改后重启容器生效：

```dotenv
FINE_TREE_CACHE_TTL_SECONDS=60
FINE_TREE_CACHE_MAX_ENTRIES=0
FINE_TREE_CACHE_MAX_MB=512
```

每个门户节点独立缓存。同一登录 token 的并发 tree 请求合并为一次调用，成功后最多保留 60 秒；缓存命中不会延长有效期。到期自动清理，下次访问重新获取；刷新失败不使用过期权限。权限变更或会话撤销最多延迟约 60 秒感知。用户状态查询和收藏接口仍逐次执行。

每个节点默认限制目录的序列化数据总量为 512 MiB，按需使用，不预分配。`FINE_TREE_CACHE_MAX_ENTRIES=0` 表示不额外限制会话数量；如填写正整数，则同时启用数量上限。触及配置上限时淘汰最久未使用的会话。单份目录超过预算时直接返回、不缓存。这个预算不是 Node.js 堆内存或容器内存硬上限；HTTP 请求和业务查询也需要工作内存。

将 `FINE_TREE_CACHE_TTL_SECONDS=0` 可关闭持续缓存，仍合并正在进行的同会话请求。无需 Redis 或新增数据库表。日志中 `stage=tree-cache` 的 `hit/shared/miss/stored/oversized` 分别表示命中、合并、未命中、已保存和单份过大；`serializedBytes` 记录数据量，日志不输出 token 或其摘要。

### 请求日志

`PORTAL_LOG_FILE=/app/logs/portal.log` 将 JSON 行日志追加到宿主机 `logs/portal.log`。记录请求路径、query、路径参数、body、Cookie 名称、身份候选数量、匹配账号、平台调用状态、错误原因和耗时；使用 requestId 关联。token、Cookie 值及密码字段不落盘。不启用独立日志服务或自动轮转。文件夹须允许容器 UID 1000 写入。

```bash
tail -f logs/portal.log
grep '请求ID' logs/portal.log
```

配置文件日志后，请求日志查看上述文件；`docker compose logs portal` 用于查看容器启动错误。若删除 `PORTAL_LOG_FILE` 配置并重启，则恢复输出到容器标准输出。旧版本升级需增加 Compose 中的 `./logs:/app/logs` 挂载，再执行 `docker compose up -d --force-recreate portal`。

`trusted-cookie` 模式依赖客户主平台或网关在转发门户 API 前校验两个 Cookie 的有效性及同一用户绑定，并阻止请求绕过该校验直达容器。门户不自行验证主平台 Cookie 签名；tree 接口成功只证明 token 有效，不单独证明 ID Cookie 与 token 属于同一人。此项是客户确认的接入前提，部署时需覆盖 `/portal/api/portal/` 路由。

如果以后改用 `FINE_IDENTITY_MODE=session`，再填写可信的 `FINE_SESSION_PATH`。该接口须返回：

```json
{"data":{"userName":"dim_bi_user.username 对应值","name":"显示名称"}}
```

目录和收藏继续使用参考项目的数据协议：

```json
{"data":[{"id":"report-id","pId":"parent-id","text":"报表名","path":"report.cpt","entryType":1,"sortIndex":1}]}
```

目录节点的 `path` 为 null；BI 模板还需要 `templateId`；外部链接 `entryType` 为 5。收藏列表返回 `{"data":[{"id":"report-id"}]}`，收藏与取消收藏返回 `{"data":"success"}`。配置只能改变地址和方法，不能自动适配另一套响应字段；字段不一致时需要调整平台适配器。

“我的目录”来自权限目录树；“最近打开”“我常用的”来自 PG 访问日志；“我收藏的”使用平台收藏列表并与权限目录取交集。最近打开的排序依据当前底表的日期精度，不宣称包含当天精确到秒的打开顺序。

## 3. 同源嵌入与反向代理

父平台和门户必须在浏览器看来同源，否则无法调用 `window.top.FS` / `window.top.BI`。后端可以使用内网地址访问平台，但浏览器不能直接使用这些地址。

门户统一部署在 `/portal/`：首页 `/portal/`、报表字典 `/portal/report-dictionary/`、API `/portal/api/portal/v1/`，图片和构建资源也在该前缀下。企业网关只需将 `/portal/` 前缀原样转发到主服务 Nginx，主服务再原样转发到门户。原平台路径继续使用原有规则。

将本目录 `nginx-portal.conf` 放入现有 `server {}`，填写 `PORTAL_HOST`。`proxy_pass http://PORTAL_HOST:3001;` **不能追加末尾斜杠**，两层代理均不剥离 `/portal`。iframe 使用 `/portal/`。主平台鉴权沿用现有配置，不新增门户鉴权服务。

该路径调整需要重新构建镜像，旧 r2 镜像仍是根路径版本，不能直接套用新配置。`src/config/portal.json` 定义固定构建前缀；Next 的 Link/router 自动处理前缀，公共图片和 CSS 使用 `/portal/assets/`。业务 API 相对路径与服务层取数逻辑保持不变。`/health` 保留为容器内健康检查地址；仅测试环境启用的 `/poc/` 不属于客户门户入口。

登录 Cookie 必须能随门户 API 请求发送，尤其要核对 Domain、Path、Secure。若平台 Cookie 只限 `/WebReport/`，需由客户平台或代理调整到覆盖 `/portal/api/portal/`，不能通过关闭鉴权绕过。部署公网源必须与 `PUBLIC_ORIGIN` 完全一致，否则收藏和搜索历史写入会被拒绝。

## 4. PostgreSQL 准备

使用客户现有 PostgreSQL，表位于 `public` schema：

- `dim_bi_report_info_dtl`、`dim_bi_report_dictionary`
- `dim_bi_user`、`dim_dept_mapping`、`dim_bi_visit_log`
- `fr_index_noticement`、`fr_quick_entry_app`
- `portal_search_history`

`report_lifecycle` 不使用。公告部门关联为 `dim_bi_user.oa_dept_code = dim_dept_mapping.dept_job_id`，使用映射后的部门名匹配公告授权部门。

由数据库管理员按实际库名、账号执行交付包 `sql/003-search-history.sql` 和 `sql/004-source-indexes.sql`；不要执行示例库的 `001-portal.sql`。这两个脚本创建门户搜索历史表/索引，不导入示例业务数据。大表索引应在客户维护窗口创建。

运行账号只需业务表 SELECT，以及 `portal_search_history` 的 SELECT、INSERT、UPDATE、DELETE。数据库管理员可参考：

```sql
GRANT CONNECT ON DATABASE bi_portal TO portal_reader;
GRANT USAGE ON SCHEMA public TO portal_reader;
GRANT SELECT ON public.dim_bi_report_info_dtl, public.dim_bi_report_dictionary,
  public.dim_bi_user, public.dim_dept_mapping, public.dim_bi_visit_log,
  public.fr_index_noticement, public.fr_quick_entry_app TO portal_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_search_history TO portal_reader;
```

需要 TLS 时配置 `DB_SSL_MODE=verify-full`；自签或企业 CA 可放在 `conf/ca.crt`，设置 `DB_SSL_CA_FILE=/app/config/ca.crt`。默认 `disable` 仅适用于客户允许的内网非 TLS 连接。

## 5. 验收与回退

`/health` 只检查服务和 PG 连接，不代表帆软接口已经联通。正式验收应在平台中用实际账号打开门户，核对目录权限、三类工作台、搜索、收藏/取消收藏、报表打开、公告部门权限及无权限账号。

镜像不执行建表、清库或示例数据初始化。客户配置不得设置 `POC_PLATFORM_URL`。备份挂载配置，并保留上一版镜像；回退时指定原 `PORTAL_IMAGE` 后重新创建容器。业务底表由客户维护，不包含在交付镜像或压缩包内。

重新构建：在项目根目录执行 `docker build --platform linux/amd64 -t ynmy-bi-portal:customer-20261112-r7 .`，再执行 `docker save -o ynmy-bi-portal-customer-20261112-r7-linux-amd64.tar ynmy-bi-portal:customer-20261112-r7`。不要用 Docker build args 或 COPY 把客户密码写进镜像。

快捷入口无用户权限过滤，仅显示 `status=1`，按 `sort_no` 升序、相同排序号按 `app_id` 排序。最新附件的两条快捷入口都是 `status=0`；是否启用由填报维护。

公告权限按当前 `username → dim_bi_user.oa_dept_code = dim_dept_mapping.dept_job_id → dept_name` 关联。`notice_dept_name` 为逗号分隔部门列表，拆分后精确 INNER JOIN，重复匹配的公告只显示一次；继续遵守公告生效和过期日期。
