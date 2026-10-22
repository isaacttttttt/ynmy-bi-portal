# 云南白药集团·数据门户

一个基于 Next.js 15 构建的企业级数据门户系统，采用响应式设计，支持多屏幕自适应。

## ✨ 项目特点

- 🎨 **1:1 像素级还原** - 完全按照设计稿实现，精确到每一个像素
- 📱 **完全响应式** - 所有组件使用 vw/百分比单位，支持 1280px-2560px 屏幕自适应
- 🎯 **TypeScript** - 全量类型覆盖，提供完整的类型提示
- ⚡ **性能优化** - 基于 Next.js 15 静态生成，首屏加载极快
- 🎭 **Tailwind CSS** - 原子化 CSS，配合响应式工具库实现精确控制
- 🎪 **Lucide Icons** - 轻量级图标库，tree-shaking 优化

## 🚀 技术栈

- **框架**: [Next.js 15.1.6](https://nextjs.org/) (App Router)
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 3
- **图标**: Lucide React
- **包管理**: npm

## 📦 项目结构

```
ynmy-bi-portal/
├── public/                      # 静态资源
│   └── assets/                  # 切图资源 (@2x)
│       ├── 页面背景@2x.png
│       ├── 驾驶舱.png
│       ├── 报表.png
│       └── ...
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── page.tsx            # 首页（数据门户）
│   │   └── report-dictionary/  # 报表字典页
│   ├── components/              # React 组件
│   │   └── portal/             # 门户相关组件
│   │       ├── PortalHeader.tsx
│   │       ├── WorkbenchModule.tsx
│   │       ├── ThematicAnalysisModule.tsx
│   │       ├── NoticeModule.tsx
│   │       ├── QuickEntryModule.tsx
│   │       └── ReportCard.tsx
│   └── lib/                     # 工具库
│       └── responsive.ts        # 响应式尺寸工具
├── 响应式改造完成报告.md        # 完整技术文档
├── 响应式系统使用指南.md        # 使用指南
├── 图标映射关系说明.md          # 切图说明
└── package.json
```

## 🎯 页面说明

### 1. 数据门户首页 (`/`)

四大核心模块：
- **我的工作台** (1300×460px) - 展示 8 张报表卡片，支持「最近打开」「我常用的」「我收藏的」分段切换
- **专题分析** (1300×321px) - 展示 6 张横向卡片，分为驾驶舱和专题两种类型
- **制度公告** (540×391px) - 展示 5 条公告列表，支持置顶标识
- **快捷入口** (540×390px) - 展示 5 个快捷入口，带浅蓝色边框

### 2. 报表字典页 (`/report-dictionary`)

- **左侧筛选栏** (220px) - 4 个分组筛选器
- **右侧字典区** (1300px) - 3×2 网格展示报表卡片

## 🎨 响应式设计系统

项目采用完全响应式设计，所有尺寸基于 **1920px 设计稿**转换：

```typescript
// 核心转换规则
30px → 1.563vw  (页面边距)
16px → 0.833vw  (模块间距)
12px → 0.625vw  (组件间距)

// 模块宽度（相对1440px版心）
1300px → 90.278%
540px → 37.5%
```

详细说明请查看 [响应式改造完成报告.md](响应式改造完成报告.md)

## 🛠️ 安装与运行

### 环境要求

- Node.js 18.17 或更高版本
- npm 9 或更高版本

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000 查看效果

### 生产构建

```bash
npm run build
npm start
```

### 类型检查

```bash
npm run type-check
```

### 代码检查

```bash
npm run lint
```

## 📐 设计规范

### 颜色系统

```typescript
主品牌蓝: #1D63FF
深炭黑: #1D2129
中灰: #4E5969
浅灰: #86909C
背景蓝灰: #EDF3FA
```

### 四套业务主题配色

1. **蓝色主题** (`blue`) - 驾驶舱类
   - 背景渐变: `linear-gradient(135deg, #EBF3FF 0%, #F7FAFF 55%, #FFFFFF 100%)`
   - 边框: `#D8E7FF`
   - 高亮: `#1D63FF`

2. **青绿主题** (`teal`) - 报表类
   - 背景渐变: `linear-gradient(135deg, #E6FAF7 0%, #F4FFFD 55%, #FFFFFF 100%)`
   - 边框: `#C8F2EB`
   - 高亮: `#009A84`

3. **紫色主题** (`purple`) - 填报类
   - 背景渐变: `linear-gradient(135deg, #F3ECFF 0%, #FAF7FF 55%, #FFFFFF 100%)`
   - 边框: `#E4D6FF`
   - 高亮: `#722ED1`

4. **暖橙主题** (`orange`) - 专题类
   - 背景渐变: `linear-gradient(135deg, #FFF5E8 0%, #FFFDF9 60%, #FFFFFF 100%)`
   - 边框: `#FFE4C4`
   - 高亮: `#D97706`

## 🖼️ 切图说明

所有切图资源放置在 `public/assets/` 目录，命名规范：

```
页面背景@2x.png       - 顶部背景大图
驾驶舱.png            - 驾驶舱类型图标 (36×36)
报表.png              - 报表类型图标 (36×36)
填报.png              - 填报类型图标 (36×36)
专题分析驾驶舱背景1.png - 专题卡片背景 (400×96)
...
```

详细切图映射请查看 [图标映射关系说明.md](图标映射关系说明.md)

## 📱 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔧 核心特性

### 响应式工具库

```typescript
import { RESPONSIVE_SIZES } from "@/lib/responsive";

// 使用预定义尺寸
<div
  style={{
    width: RESPONSIVE_SIZES.workbench.width,   // 90.278%
    height: RESPONSIVE_SIZES.workbench.height, // 23.958vw
    padding: RESPONSIVE_SIZES.modulePadding,   // 0.833vw
    fontSize: RESPONSIVE_SIZES.fontSize.lg     // 0.833vw
  }}
>
```

### 主题配置

每个报表卡片支持 4 种主题切换：

```typescript
<ReportCard
  theme="blue"  // blue | teal | purple | orange
  icon="/assets/驾驶舱.png"
  category="驾驶舱"
  title="临床纯销驾驶舱"
  subtitle="实时经营分析看板"
/>
```

## 📖 文档

- [响应式改造完成报告.md](响应式改造完成报告.md) - 完整技术文档
- [响应式系统使用指南.md](响应式系统使用指南.md) - 响应式系统详细说明
- [图标映射关系说明.md](图标映射关系说明.md) - 切图资源说明

## 🤝 贡献指南

本项目为云南白药集团内部项目，暂不接受外部贡献。

## 📄 许可证

Copyright © 2026 云南白药集团

---

**开发时间**: 2026-01-22  
**版本**: v2.0.0  
**状态**: ✅ 生产就绪
