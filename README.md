# 云南白药集团 · 数据门户

`main` 是正式交付分支。门户嵌入帆软平台，由 Fastify 提供门户静态页面和 API，数据来自客户 PostgreSQL 与帆软平台。正式版仅提供真实 API 和平台预览链路。

Railway 独立测试环境使用 `codex/realdata-pg-validation` 分支，测试平台及其部署配置保存在测试分支。客户镜像从 `main` 构建。

## 构建与验证

使用 `.node-version` 指定的 Node.js 版本。前端构建输出 `out/`，由后端提供静态文件。

```bash
npm ci
npm ci --prefix backend
npm run build
npm test
npm --prefix backend test
```

`npm --prefix backend test` 验证接口路由、权限和静态资源路径。真实 PostgreSQL 回归可在独立测试库通过 `SOURCE_TEST_DATABASE_URL` 运行 `node backend/test/portal-data.mjs`。

## 正式部署

页面、图片、脚本和 API 使用统一的 `/portal/` 前缀。网关按原路径转发。客户配置通过 `conf/portal.env` 挂载到容器。

- [Docker 部署与运行配置](deploy/README.md)
- [接口契约](docs/API.md)
- [PostgreSQL 索引](deploy/INDEXES.md)
