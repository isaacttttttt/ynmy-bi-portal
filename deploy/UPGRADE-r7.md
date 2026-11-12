# r7 升级步骤

本次将报表字典改为字典表主导的 LEFT JOIN 查询，展示全部字典记录；标题右侧用绿色“有权限”或红色“无权限”标签标记，圆角 8px。无权限记录可查看说明，打开和收藏按钮禁用。工作台仍只显示授权报表。

本版保留每节点 512 MiB 缓存默认预算，不额外限制会话数量。沿用旧 CONF 时，必须修改下面的两个容量参数，否则旧值仍然优先。

## 1. 解压新包，保留原配置

进入解压后的 r7 目录，将旧目录的 `conf/portal.env` 复制到新目录 `conf/portal.env`，覆盖示例配置。数据库、平台接口和以下三个配置保持原值：

```dotenv
FINE_IDENTITY_MODE=trusted-cookie
FINE_COOKIE_NAME=fine_auth_token
FINE_USER_COOKIE_NAME=fine_login_users
```

在 `conf/portal.env` 新增或修改：

```dotenv
PORTAL_LOG_FILE=/app/logs/portal.log
FINE_TREE_CACHE_TTL_SECONDS=60
FINE_TREE_CACHE_MAX_ENTRIES=0
FINE_TREE_CACHE_MAX_MB=512
```

## 2. 导入并替换容器

在新目录执行，`旧部署目录` 替换为实际路径。先导入镜像，再停旧容器：

```bash
docker load -i ynmy-bi-portal-customer-20261112-r7-linux-amd64.tar
mkdir -p logs
sudo chown 1000:1000 logs conf/portal.env
sudo chmod 750 logs
sudo chmod 600 conf/portal.env

docker compose -f /旧部署目录/compose.yaml down
PORTAL_IMAGE=ynmy-bi-portal:customer-20261112-r7 docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
tail -f logs/portal.log
```

如果原来修改过端口，将旧端口设置同步到新目录的 Compose 配置后再启动。使用旧版 Compose 时，将命令中的 `docker compose` 替换为 `docker-compose`。

新包已包含 `./logs:/app/logs` 挂载。本次必须替换镜像并创建新容器，仅重启旧容器不会升级代码。原 r3 的 `/portal/` Nginx 规则继续使用。

## 3. 在 BI 中验证

重新加载门户。依次检查最近打开、常用报表、收藏和快捷入口。

如果仍失败，按页面请求返回的 `X-Request-Id` 查日志：

```bash
grep '对应的请求ID' logs/portal.log
```

日志包含请求参数、Cookie 名称、用户匹配结果、BI 接口状态、耗时和错误原因。凭证值不写入日志。启动失败时执行：

```bash
docker compose -f compose.yaml logs --tail=100 portal
```

`fine_login_users` 包含多个 ID 时，按当前 token 的 `sub` 匹配对应的 `dim_bi_user.username`。访问记录仍按 `dim_bi_visit_log.user_code = dim_bi_user.username` 读取，本次无需改动业务底表。

快捷入口使用 `fr_quick_entry_app.icon_url`；仅显示 `status=1` 的记录。所提供 SQL 中两条快捷入口均为 `status=0`，本次未修改这些业务数据。

## 4. 检查缓存

```bash
grep '"stage":"tree-cache"' logs/portal.log | tail -30
```

`shared` 表示多个请求共用一次 tree 调用，`hit` 表示命中缓存。默认有效期 60 秒，每节点序列化数据预算 512 MiB；按需使用，不预分配。会话数量默认不限，仍受数据预算约束；触及预算即淘汰旧记录，超大目录不缓存。512 MiB 不等于容器内存占用上限。多节点分别配置、独立缓存。

权限变更及会话撤销可能延迟最多约 60 秒感知。需要每次重新获取权限时，设置 `FINE_TREE_CACHE_TTL_SECONDS=0` 并重启，仍保留并发请求合并。收藏操作和用户状态查询不缓存。

快捷入口无用户权限过滤，仅显示 `status=1`，按 `sort_no` 升序、相同排序号按 `app_id` 排序。最新附件的两条快捷入口都是 `status=0`；是否启用由填报维护。

公告权限按当前 `username → dim_bi_user.oa_dept_code = dim_dept_mapping.dept_job_id → dept_name` 关联。`notice_dept_name` 为逗号分隔部门列表，拆分后精确 INNER JOIN，重复匹配的公告只显示一次；继续遵守公告生效和过期日期。
