/**
 * 响应式尺寸转换工具
 * 设计稿基准宽度: 1920px
 * 版心最大宽度: 1440px (占设计稿的75%)
 */

// 设计稿基准宽度
const DESIGN_WIDTH = 1920;

/**
 * 将设计稿的 px 转换为 vw
 * @param px 设计稿中的像素值
 * @returns vw 单位字符串
 */
export function pxToVw(px: number): string {
  return `${((px / DESIGN_WIDTH) * 100).toFixed(3)}vw`;
}

/**
 * 将设计稿的 px 转换为相对于版心宽度的百分比
 * 版心宽度 1440px = 100%
 * @param px 设计稿中的像素值
 * @param containerWidth 容器宽度，默认1440px
 * @returns 百分比字符串
 */
export function pxToPercent(px: number, containerWidth = 1440): string {
  return `${((px / containerWidth) * 100).toFixed(3)}%`;
}

/**
 * 响应式尺寸配置
 * 基于设计稿的精确尺寸计算相对单位
 */
export const RESPONSIVE_SIZES = {
  // 页面外边距
  pagePaddingX: pxToVw(30), // 30px
  pagePaddingBottom: pxToVw(30), // 30px

  // 模块间距
  moduleGap: pxToVw(16), // 16px

  // 模块内边距
  modulePadding: pxToVw(16), // 16px

  // 组件间距
  componentGap: pxToVw(12), // 12px
  headerMarginBottom: pxToVw(12), // 12px

  // 模块宽度 (基于1440px版心)
  workbench: {
    width: pxToPercent(1300, 1440), // 90.278%
    height: pxToVw(460)
  },
  thematic: {
    width: pxToPercent(1300, 1440), // 90.278%
    height: pxToVw(321)
  },
  notice: {
    width: pxToPercent(540, 1440), // 37.5%
    height: pxToVw(391)
  },
  quickEntry: {
    width: pxToPercent(540, 1440), // 37.5%
    height: pxToVw(390)
  },

  // 卡片尺寸
  reportCard: {
    width: pxToPercent(303, 1300), // 相对于工作台宽度 23.308%
    height: pxToVw(180)
  },
  horizontalCard: {
    width: pxToPercent(409, 1300), // 相对于专题分析宽度 31.462%
    height: pxToVw(110),
    textOffset: pxToVw(112) // 文字左偏移
  },

  // 字体大小
  fontSize: {
    xs: pxToVw(11),
    sm: pxToVw(12),
    base: pxToVw(13),
    md: pxToVw(15),
    lg: pxToVw(16),
    xl: pxToVw(17),
    xxl: pxToVw(22)
  },

  // 圆角
  borderRadius: {
    sm: pxToVw(8),
    md: pxToVw(12),
    lg: pxToVw(16),
    full: "9999px"
  },

  // 图标尺寸
  iconSize: {
    xs: pxToVw(20),
    sm: pxToVw(28),
    md: pxToVw(36),
    lg: pxToVw(40),
    xl: pxToVw(52)
  }
} as const;

/**
 * 生成响应式样式对象
 */
export function createResponsiveStyle(config: {
  width?: string;
  height?: string;
  padding?: string;
  margin?: string;
  gap?: string;
  fontSize?: string;
  borderRadius?: string;
}) {
  const style: Record<string, string> = {};

  if (config.width) style.width = config.width;
  if (config.height) style.height = config.height;
  if (config.padding) style.padding = config.padding;
  if (config.margin) style.margin = config.margin;
  if (config.gap) style.gap = config.gap;
  if (config.fontSize) style.fontSize = config.fontSize;
  if (config.borderRadius) style.borderRadius = config.borderRadius;

  return style;
}

/**
 * Grid 列宽计算
 * 左栏9列 (1300px) + 间距16px + 右栏3列 (540px) = 1856px
 * 比例: 69.83% : 1.72% : 28.45%
 */
export const GRID_LAYOUT = {
  left: {
    cols: "9",
    widthPercent: "69.83%" // 1300/1860 * 100
  },
  right: {
    cols: "3",
    widthPercent: "28.45%" // 540/1900 * 100
  },
  gap: pxToVw(16)
} as const;
