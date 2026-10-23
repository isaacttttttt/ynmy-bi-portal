/**
 * REM 自适应布局工具
 * 设计稿基准: 1920px
 * rem 基准: 100px (即 1rem = 100px)
 */

// 设计稿宽度
const DESIGN_WIDTH = 1920;

// rem 基准值
const BASE_FONT_SIZE = 100;

/**
 * px 转 rem
 * @param px 设计稿上的 px 值
 * @returns rem 值字符串
 */
export function pxToRem(px: number): string {
  return `${(px / BASE_FONT_SIZE).toFixed(4)}rem`;
}

/**
 * 设置 html 根元素字体大小
 * 根据屏幕宽度动态计算
 */
export function setRootFontSize(): void {
  const docEl = document.documentElement;
  const clientWidth = docEl.clientWidth;

  if (!clientWidth) return;

  // 计算当前屏幕下的 rem 基准值
  // 公式: 当前屏幕宽度 / 设计稿宽度 * 基准字体大小
  const fontSize = (clientWidth / DESIGN_WIDTH) * BASE_FONT_SIZE;

  // 设置最小和最大字体大小限制
  const minFontSize = 50; // 最小 50px (适配小屏)
  const maxFontSize = 150; // 最大 150px (适配超大屏)

  const finalFontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));

  docEl.style.fontSize = `${finalFontSize}px`;
}

/**
 * 初始化 REM 适配
 */
export function initRemAdapter(): void {
  // 初始设置
  setRootFontSize();

  // 监听窗口大小变化
  let resizeTimer: NodeJS.Timeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setRootFontSize();
    }, 100);
  });

  // 监听 DOMContentLoaded
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setRootFontSize();
  } else {
    document.addEventListener("DOMContentLoaded", setRootFontSize);
  }
}

// REM 尺寸预定义常量
export const REM_SIZES = {
  // 页面级
  page: {
    maxWidth: pxToRem(1440),      // 版心最大宽度
    paddingX: pxToRem(24),         // 左右边距
    paddingBottom: pxToRem(32),    // 底部边距
  },

  // 模块级
  module: {
    gap: pxToRem(20),              // 模块间距
    padding: pxToRem(20),          // 模块内边距
    borderRadius: pxToRem(16),     // 模块圆角
  },

  // 组件级
  component: {
    gap: pxToRem(16),              // 组件间距
    smallGap: pxToRem(12),         // 小间距
    tinyGap: pxToRem(8),           // 微小间距
  },

  // 字体大小
  fontSize: {
    xs: pxToRem(11),               // 11px
    sm: pxToRem(12),               // 12px
    base: pxToRem(13),             // 13px
    md: pxToRem(15),               // 15px
    lg: pxToRem(16),               // 16px
    xl: pxToRem(17),               // 17px
    xxl: pxToRem(22),              // 22px
  },

  // 图标大小
  icon: {
    xs: pxToRem(20),               // 20px
    sm: pxToRem(28),               // 28px
    md: pxToRem(36),               // 36px
    lg: pxToRem(40),               // 40px
    xl: pxToRem(52),               // 52px
  },

  // Header
  header: {
    height: pxToRem(136),          // Header 高度
    logoSize: pxToRem(48),         // Logo 尺寸
    searchHeight: pxToRem(44),     // 搜索框高度
    searchWidth: pxToRem(520),     // 搜索框宽度
    buttonHeight: pxToRem(44),     // 按钮高度
  },

  // 卡片尺寸
  card: {
    reportHeight: pxToRem(148),    // 报表卡片高度
    horizontalHeight: pxToRem(96), // 横向卡片高度
    borderRadius: pxToRem(12),     // 卡片圆角
  },
};

/**
 * 批量转换 px 对象为 rem 对象
 */
export function pxObjectToRem<T extends Record<string, number>>(obj: T): Record<keyof T, string> {
  const result = {} as Record<keyof T, string>;
  for (const key in obj) {
    result[key] = pxToRem(obj[key]);
  }
  return result;
}

/**
 * 创建响应式样式对象
 */
export function createRemStyle(styles: Record<string, number | string>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(styles)) {
    if (typeof value === "number") {
      result[key] = pxToRem(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// 导出工具函数
export default {
  pxToRem,
  setRootFontSize,
  initRemAdapter,
  REM_SIZES,
  pxObjectToRem,
  createRemStyle,
};
