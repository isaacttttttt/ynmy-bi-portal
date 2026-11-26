/**
 * 切图资源映射配置
 * 所有切图路径统一管理，方便一键替换文件名
 */

export const ASSETS_MAP = {
  // 背景大图
  pageBackground: "/portal/assets/页面背景@2x.png",

  // Logo与品牌
  companyLogo: "/portal/assets/yunnan_baiyao.svg",
  companyTitle: "/portal/assets/title.png",

  // 收藏星标
  favoriteIcon: "/portal/assets/fav_icon.png",
  favoritedIcon: "/portal/assets/faved_icon.png",

  // 通用图标
  iconBlue: "/portal/assets/icon_blue.png",
  icon1: "/portal/assets/图标_综合_1@2x.png",
  icon2: "/portal/assets/图标_综合_2@2x.png",
  icon3: "/portal/assets/图标_综合_3@2x.png",

  // 箭头图标
  arrow1: "/portal/assets/图标_综合_箭头1@2x.png",
  arrow2: "/portal/assets/图标_综合_箭头2@2x.png",
  arrow3: "/portal/assets/图标_综合_箭头3@2x.png",
  arrow4: "/portal/assets/图标_综合_箭头4@2x.png",

  // ===== 我的工作台模块图标 =====
  workbenchDashboard: "/portal/assets/驾驶舱.png",      // 驾驶舱类型卡片
  workbenchReport: "/portal/assets/报表.png",           // 报表类型卡片
  workbenchFillIn: "/portal/assets/填报.png",           // 填报类型卡片

  // ===== 专题分析模块图标 =====
  // 驾驶舱背景 (第一行)
  thematicDashboard1: "/portal/assets/专题分析驾驶舱背景1.png",
  thematicDashboard2: "/portal/assets/专题分析驾驶舱背景2.png",
  thematicDashboard3: "/portal/assets/专题分析驾驶舱背景3.png",
  // 专题文件夹背景 (第二行)
  thematicFolder: "/portal/assets/专题分析专题背景.png",

  // ===== 旧版图标 (保留用于字典页等其他模块) =====
  reportIcon1: "/portal/assets/指标卡背景_1@2x.png",
  reportIcon2: "/portal/assets/指标卡背景_2@2x.png",
  reportIcon3: "/portal/assets/指标卡背景_3@2x.png",
  reportIcon4: "/portal/assets/指标卡背景_4@2x.png",
  reportIcon5: "/portal/assets/指标卡背景_5@2x.png",
  reportIcon6: "/portal/assets/指标卡背景_6@2x.png",
  reportIcon7: "/portal/assets/指标卡背景_7@2x.png",
  reportIcon8: "/portal/assets/指标卡背景_8@2x.png",
  reportIcon9: "/portal/assets/指标卡背景_9@2x.png",
  reportIcon10: "/portal/assets/指标卡背景_10@2x.png",
  reportIcon11: "/portal/assets/指标卡背景_11@2x.png",
  reportIcon12: "/portal/assets/指标卡背景_12@2x.png",

  // 文件夹图标 (备用)
  folderBg1: "/portal/assets/bg1.png",
  folderBg2: "/portal/assets/bg2.png",
  folderBg3: "/portal/assets/bg3.png",
  folderBg4: "/portal/assets/bg4.png",

  // 装饰元素
  decoration: "/portal/assets/图标装饰@2x.png",
  button1: "/portal/assets/按钮背景_1@2x.png",
  button2: "/portal/assets/按钮背景_2@2x.png",
  timeIcon: "/portal/assets/时间@2x.png",
  pinnedIcon: "/portal/assets/置顶@2x.png",

  // 其他背景
  background1: "/portal/assets/背景1@2x.png",
  background2: "/portal/assets/背景2@2x.png",
} as const;

export type AssetKey = keyof typeof ASSETS_MAP;

/**
 * 图标映射关系说明
 *
 * 【我的工作台模块】
 * - 驾驶舱 → 驾驶舱.png
 * - 报表 → 报表.png
 * - 填报 → 填报.png
 *
 * 【专题分析模块】
 * - 驾驶舱 (第一行) → [专题分析驾驶舱背景1.png, 专题分析驾驶舱背景2.png, 专题分析驾驶舱背景3.png]
 * - 专题 (第二行) → 专题分析专题背景.png
 */
