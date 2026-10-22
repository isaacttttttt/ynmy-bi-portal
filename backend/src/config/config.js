export default {
  // 帆软平台配置
  fineReport: {
    serverPath: process.env.FINE_REPORT_SERVER_PATH || 'http://localhost:8080',
    rootId: process.env.FINE_REPORT_ROOT_ID || 'decision-directory-root',
    rootName: process.env.FINE_REPORT_ROOT_NAME || '根目录',
    iconRootPath: '/assets/icons/',
    imgType: 'png',
  },

  // 报表卡片颜色配置
  reportColors: {
    dashboard: 'blue', // 驾驶舱 - 浅蓝色
    report: 'green',   // 报表 - 浅绿色
    form: 'purple',    // 填报表 - 浅紫色
  },

  // 报表类型映射
  reportTypes: {
    frm: 'frm',
    fvs: 'fvs',
    cpt: 'cpt',
    bi: 'bi',
    url: 'url',
    cate: 'cate', // 文件夹
  },

  // 分页配置
  pagination: {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 100,
  },
};
