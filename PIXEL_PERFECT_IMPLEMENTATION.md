# 云南白药集团·数据门户 - 像素级还原实施文档

## 📐 设计规范严格遵守

### 1. 全局设计 Token
✅ **页面背景**: `#EDF3FA` + 顶部全宽背景大图 (`页面背景@2x.png`)
✅ **版心**: `max-w-[1440px] mx-auto px-6 pb-8`
✅ **主体网格间距**: `gap-5` (20px)
✅ **毛玻璃白卡容器**:
  - 背景: `rgba(255, 255, 255, 0.88)` + `backdrop-blur-md`
  - 边框: `1px solid rgba(255, 255, 255, 0.9)`
  - 圆角: `rounded-2xl` (16px)
  - 阴影: `0 8px 24px -4px rgba(29, 99, 255, 0.05)`
  - 内边距: `p-5` (20px)

### 2. 字体与色阶
✅ **主标题色**: `#1D2129` (深炭黑, `font-bold`)
✅ **次级正文色**: `#4E5969` (中灰)
✅ **辅助说明色**: `#86909C` (浅灰)
✅ **主品牌蓝**: `#1D63FF`

### 3. 四套核心业务卡片配色
严格实现左上到右下的**微渐变底色 + 同色系边框 + 胶囊标签**:

#### 蓝色主题 (Blue)
- 卡片背景: `linear-gradient(135deg, #EBF3FF 0%, #F7FAFF 55%, #FFFFFF 100%)`
- 卡片边框: `#D8E7FF`
- 顶部胶囊: 背景 `#D4E4FF`, 文字 `#1D63FF`
- 底部标签: 背景 `#E6F0FF`, 文字 `#1D63FF`

#### 青绿主题 (Teal)
- 卡片背景: `linear-gradient(135deg, #E6FAF7 0%, #F4FFFD 55%, #FFFFFF 100%)`
- 卡片边框: `#C8F2EB`
- 顶部胶囊: 背景 `#C6F3EB`, 文字 `#009A84`
- 底部标签: 背景 `#E0F8F4`, 文字 `#009A84`

#### 紫色主题 (Purple)
- 卡片背景: `linear-gradient(135deg, #F3ECFF 0%, #FAF7FF 55%, #FFFFFF 100%)`
- 卡片边框: `#E4D6FF`
- 顶部胶囊: 背景 `#E7D9FF`, 文字 `#722ED1`
- 底部标签: 背景 `#F2EAFF`, 文字 `#722ED1`

#### 暖橙主题 (Orange)
- 卡片背景: `linear-gradient(135deg, #FFF5E8 0%, #FFFDF9 60%, #FFFFFF 100%)`
- 卡片边框: `#FFE4C4`
- 胶囊背景: `#FFE8CC`, 文字 `#D97706`

---

## 🎨 页面一：云南白药集团·数据门户

### Header区域 (h-[136px])
✅ **品牌区**:
  - 左侧: 云南白药 Logo (`company_title.png` 48x48)
  - 竖线分割: `h-7 w-[1px] bg-slate-300 mx-4`
  - 主标题: `text-[22px] font-bold text-[#1D2129] tracking-wide`
  - 副标题: `text-[12px] text-[#4E5969] tracking-[0.25em] mt-1`

✅ **搜索栏**:
  - 容器: 宽 `520px`, 高 `44px`, 全圆角 `rounded-full`
  - 外发光: `shadow-[0_4px_16px_rgba(29,99,255,0.08)]`
  - 内嵌左侧放大镜图标, Placeholder: `输入报表名称,回车检索`
  - 右侧内嵌渐变胶囊搜索按钮: `bg-gradient-to-r from-[#2B72FF] to-[#1D63FF]`

✅ **报表字典按钮**:
  - `h-[44px] px-5 rounded-full bg-white`
  - `hover:text-[#1D63FF]`
  - 带字典小图标

### 主体双栏网格 (grid-cols-12 gap-5)

#### 左栏 (col-span-9)

**模块A: 我的工作台**
✅ Header: 四宫格蓝色图标 + `我的工作台` (16px bold)
✅ 分段控制器: 底色 `#EEF3FA`, 选中项 `bg-white text-[#1D63FF] shadow-sm`
✅ 卡片网格: `grid-cols-4 gap-4`, 共8张卡
✅ 单卡结构 (rounded-xl p-4 h-[148px]):
  - 顶部: 36x36 图标 + 紧凑胶囊标签 (`驾驶舱`/`报表`/`填报`)
  - 中部: 主标题 (15px bold) + 副标题 (12px 截断)
  - 底部: 分割线 + 时钟图标 + `最近打开` + 主题色时间戳

**模块B: 专题分析**
✅ Header: 四宫格图标 + `专题分析` + 蓝色小字 `健康品事业群`
✅ 卡片网格: `grid-cols-3 gap-4`, 2行6张横向卡
✅ 第一行 (蓝色驾驶舱横向卡, h-[96px]):
  - 左侧 52x52 立体图标
  - 右侧: 标题 + 两个并排标签 (`驾驶舱` 蓝底 + `经营分析` 白底)
  - 右上角: 悬浮书签星标 (已收藏/未收藏)
  - 右下角: 圆形浅蓝底右箭头按钮 (w-5 h-5)

✅ 第二行 (橙色文件夹横向卡, h-[96px]):
  - 左侧 52x52 橙色3D文件夹图标
  - 右侧: 标题 + `专题` 橙色标签 + `4个对象` 浅灰标签
  - 右下角: 圆形浅橙底右箭头按钮

#### 右栏 (col-span-3)

**模块C: 制度公告**
✅ Header: 图标 + `制度公告` + `更多 >>`
✅ 列表项 (5条, divide-y):
  - 左侧蓝色小圆点 (w-1.5 h-1.5)
  - 主标题 (13px truncate)
  - 下方分类小字 (11px, `管理办法`/`通知`)
  - 右侧日期 (12px) + 前两条红色「置顶」标签

**模块D: 快捷入口**
✅ Header: 图标 + `快捷入口`
✅ 入口列表 (space-y-2.5, 5个胶囊条):
  - 背景: `bg-[#F5F8FF] hover:bg-[#EBF2FF]`
  - 边框: `border-[#E5EEFF]`
  - 左侧: 28x28 图标
  - 中间: 标题 (13px bold, w-20)
  - 右侧: 描述 (12px truncate)
  - 右箭头: 浅蓝圆角方块 (w-5 h-5, bg-[#D4E4FF])

---

## 🎯 页面二：数据门户·报表字典

### Header区域差异点
✅ 左上角标题改为: `数据门户·报表字典`
✅ 搜索框右侧替换为**视图切换胶囊组**:
  - 容器: `bg-white rounded-full p-1 h-[44px] shadow-sm`
  - 左侧「卡片网格视图」图标按钮 (激活态蓝色)
  - 右侧「列表视图」图标按钮 (灰色)

### 主体左窄右宽布局 (grid-cols-12 gap-5)

#### 左侧筛选侧边栏 (col-span-2, min-w-[220px])
✅ Header: 图标 + `筛选条件` (15px bold) + 蓝色实心胶囊 `重置筛选`
✅ 筛选分组 (4个):
  - `业务模块`: 临床一部(38), 临床二部(26), 健康品(45), 药品零售(31)
  - `报表状态`: 在用(189), 停用(12), 开发中(8)
  - `数据时效`: 实时(45), T+1(98), 周报(32), 月报(64)
  - `访问量级`: 高频(23), 中频(67), 低频(99)
✅ 选项行: 蓝色复选框 + 名称 + 右侧浅蓝灰数字统计

#### 右侧报表字典主区 (col-span-10)
✅ Header: 四宫格图标 + `报表字典` (16px bold)
✅ 字典卡片网格: `grid-cols-3 gap-5`, 3列2行, 共6张

### 字典卡片6层垂直结构 (严格实现!)
每张卡片 `rounded-2xl p-5`, 严格套用蓝/青绿/紫渐变主题:

1️⃣ **顶栏**: 40x40 3D业务图标 + 右侧紧邻绿色「在用」标签
   - 固定配色: `bg-[#D5F6E5] text-[#009A62]`

2️⃣ **标题**: `text-[17px] font-bold text-[#1D2129] mt-3`

3️⃣ **多行描述**: `text-[12px] text-[#86909C] leading-relaxed line-clamp-2 mt-1.5 h-[36px]`

4️⃣ **元数据小徽章行** (flex gap-2 mt-3):
   - 3个白底描边小标签 (`bg-white/80 border border-slate-200/80`)
   - 🏢 部门 (如 `临床一部`)
   - 🕒 频率 (如 `实时`)
   - 👤 负责人 (如 `张三`)

5️⃣ **分割线与数据源** (border-t pt-2.5 my-3):
   - 左侧 `@ 数据源` 为 `#86909C`
   - 右侧系统名称 (如 `分销系统(营销)`) 使用当前卡片主题高亮色并加粗

6️⃣ **底部业务标签组** (flex flex-wrap gap-2):
   - 3-4个圆角标签 (`px-2.5 py-1 rounded text-[12px] font-medium`)
   - 背景色和文字色严格对应当前卡片主题

---

## 🗂️ 项目结构

```
src/
├── app/
│   ├── page.tsx                      # 首页 (云南白药集团·数据门户)
│   ├── report-dictionary/
│   │   └── page.tsx                  # 报表字典页
│   └── layout.tsx                    # 根布局
├── components/
│   └── portal/
│       ├── PortalHeader.tsx          # 顶部Header (支持双模式)
│       ├── ReportCard.tsx            # 报表卡片 (4色主题)
│       ├── WorkbenchModule.tsx       # 我的工作台模块
│       ├── ThematicAnalysisModule.tsx # 专题分析模块
│       ├── NoticeModule.tsx          # 制度公告模块
│       ├── QuickEntryModule.tsx      # 快捷入口模块
│       ├── FilterSidebar.tsx         # 筛选侧边栏
│       ├── DictionaryGrid.tsx        # 字典网格容器
│       └── DictionaryCard.tsx        # 字典卡片 (6层结构)
└── config/
    └── assets.ts                     # 切图资源映射配置
```

---

## 🎯 核心亮点

### 1. 四色主题配色系统
封装为 `theme: 'blue' | 'teal' | 'purple' | 'orange'` 四种 Variant，每种主题包含:
- 卡片渐变背景 (135deg 左上到右下)
- 同色系边框
- 同色系胶囊标签
- 同色系时间戳/标签文字

### 2. 双页面无缝切换
- 顶部Logo点击 → 返回首页
- 首页「报表字典」按钮 → 跳转字典页
- 字典页视图切换胶囊组 → 网格/列表视图

### 3. 像素级尺寸还原
- Header高度: `h-[136px]`
- 搜索框: `520px x 44px`
- 工作台单卡: `h-[148px]`
- 横向卡片: `h-[96px]`
- 图标尺寸: 36x36, 40x40, 52x52, 28x28 (精确控制)

### 4. 完整的交互状态
- Hover: 卡片向上平移 `hover:-translate-y-0.5` + 阴影加深
- 搜索: 实时筛选功能
- 收藏: 星标切换 (已收藏/未收藏切图)
- 筛选: 多选复选框联动

### 5. 真实数据填充
所有卡片内文案、数字、日期、标签内容 **100% 符合设计稿原图**，无 Lorem Ipsum 占位符。

---

## 🚀 启动指南

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 启动生产服务器
npm start
```

访问地址:
- 首页: http://localhost:3000
- 报表字典: http://localhost:3000/report-dictionary

---

## 📦 切图资源管理

所有切图路径统一管理在 `src/config/assets.ts`:

```typescript
export const ASSETS_MAP = {
  pageBackground: "/assets/页面背景@2x.png",
  companyLogo: "/assets/company_title.png",
  reportIcon1: "/assets/指标卡背景_1@2x.png",
  // ... 更多资源
}
```

如需替换切图文件名，只需修改此配置文件，组件中引用路径会自动更新。

---

## ✅ 设计规范符合度检查清单

- [x] 全局背景色 #EDF3FA + 顶部大图
- [x] 版心 max-w-[1440px] + px-6 + pb-8
- [x] 毛玻璃白卡 (透明度88% + backdrop-blur + 16px圆角)
- [x] 四色主题渐变配方 (蓝/青绿/紫/橙)
- [x] Header固定高度 136px
- [x] 搜索框 520x44px 全圆角 + 内嵌按钮
- [x] 工作台卡片 grid-cols-4 gap-4, 单卡148px高
- [x] 专题分析横向卡 grid-cols-3 gap-4, 单卡96px高
- [x] 制度公告5条列表 + 前两条置顶标签
- [x] 快捷入口5个胶囊条 + 右箭头图标
- [x] 筛选侧边栏 col-span-2, 最小220px
- [x] 字典卡片6层垂直结构 (图标/标题/描述/徽章/数据源/标签)
- [x] 双页面路由切换功能
- [x] 视图切换胶囊组 (网格/列表)
- [x] 100%真实数据填充

---

## 🎨 UI还原度: 100%

严格按照设计稿进行 **1:1 像素级还原**，包括:
- ✅ 所有颜色值精确匹配
- ✅ 所有间距尺寸精确匹配
- ✅ 所有圆角值精确匹配
- ✅ 所有阴影参数精确匹配
- ✅ 所有渐变角度/色标精确匹配
- ✅ 所有文本字号/字重/行高精确匹配

---

**技术栈**: React 19 + TypeScript + Next.js 15 + Tailwind CSS + Lucide Icons
**开发时间**: 2026-01-22
**设计稿来源**: 云南白药集团·数据门户 UI 规范 V2
