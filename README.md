# 云南白药集团 · 数据门户

嵌入帆软平台的桌面门户，使用 Next.js 15、React 19、TypeScript、Tailwind CSS。保留设计稿的蓝白视觉与 `public/assets` 切图，支持1280–2560px桌面视口；较窄窗口保留桌面布局并横向滚动，不提供移动端适配。

前端和 Fastify 后端已实现，测试环境部署在 Railway：门户静态页面和 API 同源，PostgreSQL 与帆软模拟服务通过内网连接。真实底表和真实帆软会话尚未接入。

测试入口：[Railway 测试平台](https://portal-production-c6e5.up.railway.app/poc/)。访问码仅保存在本地 `artifacts/qa/Railway测试访问码.txt`，不提交到仓库。

## 本地运行

```powershell
npm install
npm run dev
```

首页：`http://localhost:3000/portal/`；报表字典：`http://localhost:3000/portal/report-dictionary/`。

默认使用明确标注的演示数据。收藏保存在当前浏览器的演示命名空间；报表打开显示接入提示。未配置地址的快捷入口不可点击。

## 验证与构建

```powershell
npm run type-check
npm test
npm run build
```

构建输出 `out/`，由静态服务器提供服务，不使用 `next start`。浏览器回归见 [前端交接文档](docs/FRONTEND_HANDOFF.md)，截图在本地 `artifacts/qa/`。

## 后端接入

复制 `.env.example` 为 `.env.local`，后端就绪后设置 `NEXT_PUBLIC_PORTAL_MODE=api` 并重新构建。门户通过 `/portal/api/portal/v1` 获取数据。所有目录权限、公告可见范围、统计数量及分页须在后端处理。

- [接口契约与底表交接问题](docs/API.md)
- [后端服务、Railway 部署与测试](docs/BACKEND_HANDOFF.md)

## 单路径部署与验证

页面、图片、脚本和业务 API 统一使用 `/portal/` 前缀。两层网关均原样转发该前缀，不重写路径。见 [部署说明](deploy/README.md) 和 [Nginx 配置](deploy/nginx-portal.conf)。旧 r2 镜像不适用，需要重新构建。

```bash
NEXT_PUBLIC_PORTAL_MODE=api npm run build
npm test
npm --prefix backend run test:routes
npm run test:prefix
```

`test:prefix` 使用已有 Playwright 环境；未安装在项目中时，通过 `PLAYWRIGHT_MODULE` 指向可用模块，`BROWSER_CHANNEL` 默认 `msedge`。测试启动实际后端静态服务，通过现有演示数据模拟业务接口，验证搜索导航、字典刷新和所有本地请求的前缀，不连接客户数据库。真实数据库及 BI 联调使用现有后端集成测试，需另外配置测试环境。
- [前端交接、设计规则与验收方法](docs/FRONTEND_HANDOFF.md)
- `src/lib/portal-model.ts`：前后端共享的数据结构说明
- `src/lib/portal-api.ts`：HTTP入口、演示切换、帆软预览适配
- `src/lib/portal-mock.ts`：模拟接口

历史响应式与交付报告保留用于追溯；若与上述两份文档冲突，以本次接口契约和交接文档为准。
