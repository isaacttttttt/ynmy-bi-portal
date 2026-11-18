# r9 升级说明

本版修复报表上线日期为空字符串时，工作台、报表字典和搜索查询返回 503 的问题。所属组织改用 `business_group`；最近打开与近30天最常用各显示8条，两行四列。搜索历史保存、清空和收藏操作统一使用 POST；读取使用 GET。错误日志补充具体原因、调用堆栈、接口及 requestId。

## 1. 在原部署目录升级

将新包中的镜像 tar 文件及对应 `.tar.sha256` 文件放到原部署目录。保留原来的 `conf/portal.env`、日志目录、端口和 Nginx 配置。

```bash
sha256sum -c ynmy-bi-portal-customer-20261116-r9-linux-amd64.tar.sha256
docker load -i ynmy-bi-portal-customer-20261116-r9-linux-amd64.tar
```

编辑原 `compose.yaml`，将 `portal` 服务的 `image` 改为：

```yaml
    image: ynmy-bi-portal:customer-20261116-r9
```

确认原 `conf/portal.env` 中有：

```ini
PORTAL_LOG_FILE=/app/logs/portal.log
```

执行：

```bash
docker compose -f compose.yaml up -d --force-recreate portal
docker compose -f compose.yaml images
docker compose -f compose.yaml ps
```

使用 `docker-compose` 的环境，将上述命令中的 `docker compose` 换成 `docker-compose`。本次必须重新创建容器，单纯 restart 不会更新镜像。

## 2. 重新加载门户

在 BI 平台内重新加载门户。搜索关键词后点击“搜索”，确认 Network 中出现 `POST /portal/api/portal/v1/search-history`。刷新后再次点击搜索框，应显示搜索历史。

本版使用附件中的 `dim_bi_report_dictionary.business_group` 字段；正式库需存在该字段。搜索历史仍写入原 `portal_search_history`，无须重建表。

## 3. 查看失败原因

在部署目录执行以下命令，再回到页面操作：

```bash
tail -n 200 -f logs/portal.log
```

筛选错误记录：

```bash
grep '"msg":"request failed"' logs/portal.log | tail -20
```

每条失败日志含 `route`、`code`、`reason`、`stack`、`requestId`。按浏览器响应中的 requestId 查看同一次请求：

```bash
grep '替换为实际requestId' logs/portal.log
```

启动失败时查看：

```bash
docker compose -f compose.yaml logs --tail=100 portal
```

公告与专题显示“暂无符合条件的内容”时，先检查相应接口返回的数据；空列表不等于服务报错。公告继续按当前用户的 OA 部门映射和有效日期筛选，专题继续按平台授权目录与 `FINE_ROOT_ID` 展示。
