# 开发指南

## 🛠️ 开发环境设置

### 前置要求
- Node.js >= 18.0.0
- npm >= 9.0.0 或 pnpm >= 8.0.0
- MySQL >= 8.0

### IDE 推荐配置
- VS Code
- 插件：
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin (Volar)

## 📦 依赖安装

### 前端
```bash
npm install
```

### 后端
```bash
cd backend
npm install
```

## 🔧 本地开发

### 1. 启动后端服务
```bash
cd backend
cp .env.example .env
# 编辑 .env 配置数据库连接
npm run dev
```

### 2. 启动前端开发服务器
```bash
npm run dev
```

### 3. 访问应用
打开浏览器访问 `http://localhost:3000`

## 📝 开发规范

### 组件开发规范

#### 组件命名
- 使用 PascalCase 命名组件文件：`ReportCard.tsx`
- 组件导出使用 `export default`
- 使用有意义的组件名称

#### 组件结构
```tsx
"use client"; // 如果是客户端组件

import { useState } from "react";
import { ComponentProps } from "./types";

interface MyComponentProps {
  title: string;
  data?: any[];
}

export default function MyComponent({ title, data = [] }: MyComponentProps) {
  // Hooks
  const [state, setState] = useState();

  // 事件处理
  const handleClick = () => {
    // ...
  };

  // 渲染
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### 样式规范

#### 使用 Tailwind CSS
```tsx
// ✅ 推荐
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-md">
  
// ❌ 避免
<div style={{ display: 'flex', padding: '24px' }}>
```

#### 使用 cn 工具函数处理条件样式
```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "base-class",
  isActive && "active-class",
  isDisabled && "disabled-class"
)}>
```

### API 开发规范

#### 路由命名
- 使用 RESTful 风格
- 使用复数名词：`/api/reports`
- 使用连字符分隔：`/api/quick-entries`

#### 响应格式
```javascript
// 成功响应
{
  "success": true,
  "data": { ... }
}

// 失败响应
{
  "success": false,
  "message": "错误信息",
  "error": "详细错误"
}

// 分页响应
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### Git 工作流

#### 分支管理
- `main` - 主分支（生产环境）
- `develop` - 开发分支
- `feature/*` - 功能分支
- `bugfix/*` - 修复分支
- `hotfix/*` - 紧急修复

#### 提交信息规范
```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式（不影响功能）
- refactor: 重构
- perf: 性能优化
- test: 测试相关
- chore: 构建/工具相关

示例：
```
feat(workbench): 添加最近打开功能

- 实现最近打开列表查询
- 添加访问记录功能
- 优化卡片展示样式

Closes #123
```

## 🧪 测试

### 前端测试
```bash
# 待实现
npm test
```

### 后端测试
```bash
cd backend
npm test
```

## 🐛 调试

### 前端调试
1. Chrome DevTools
2. React Developer Tools
3. 使用 `console.log` 或 `debugger`

### 后端调试
1. 查看日志输出
2. 使用 VS Code 调试器
3. 检查数据库查询日志

## 📊 性能优化

### 前端优化
- 使用 React.memo 避免不必要的重渲染
- 使用 useMemo 和 useCallback 缓存计算结果
- 图片懒加载
- 代码分割

### 后端优化
- 数据库索引优化
- 使用连接池
- API 响应缓存
- 查询优化（避免 N+1 查询）

## 🔍 常见问题

### Q: 前端启动报错
A: 检查 Node.js 版本，确保 >= 18.0.0

### Q: 数据库连接失败
A: 检查 .env 配置，确保数据库服务已启动

### Q: 图片加载失败
A: 检查图片路径，确保在 /public 目录下

### Q: API 请求跨域
A: 后端已配置 CORS，检查请求地址是否正确

## 📚 参考资源

- [Next.js 文档](https://nextjs.org/docs)
- [React 文档](https://react.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [Ant Design 文档](https://ant.design/components/overview-cn/)
- [Fastify 文档](https://www.fastify.io/docs/latest/)

## 🤝 团队协作

### 代码审查
- 每个 PR 需要至少一人审查
- 确保代码符合规范
- 检查功能是否完整
- 确保无明显 bug

### 沟通渠道
- 技术问题：开发群
- 需求讨论：需求会议
- Bug 反馈：Issue 系统

## 📅 发布流程

1. 功能开发完成
2. 提交 PR 到 develop
3. 代码审查
4. 合并到 develop
5. 测试环境验证
6. 合并到 main
7. 发布生产环境
