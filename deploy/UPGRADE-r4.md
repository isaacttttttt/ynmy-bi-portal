# r4 升级步骤

本次修复多账号 Cookie 导致的 `INVALID_IDENTITY`，增加文件日志，并支持快捷入口直接加载数据库中的 `icon_url`。

## 1. 解压新包，保留原配置

进入解压后的 r4 目录，将旧目录的 `conf/portal.env` 复制到新目录 `conf/portal.env`，覆盖示例配置。数据库、平台接口和以下三个配置保持原值：

```dotenv
FINE_IDENTITY_MODE=trusted-cookie
FINE_COOKIE_NAME=fine_auth_token
FINE_USER_COOKIE_NAME=fine_login_users
```

在 `conf/portal.env` 新增或修改：

```dotenv
PORTAL_LOG_FILE=/app/logs/portal.log
```

## 2. 导入并替换容器

在新目录执行，`旧部署目录` 替换为实际路径。先导入镜像，再停旧容器：

```bash
docker load -i ynmy-bi-portal-customer-20261112-r4-linux-amd64.tar
mkdir -p logs
sudo chown 1000:1000 logs conf/portal.env
sudo chmod 750 logs
sudo chmod 600 conf/portal.env

docker compose -f /旧部署目录/compose.yaml down
PORTAL_IMAGE=ynmy-bi-portal:customer-20261112-r4 docker compose -f compose.yaml up -d
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
