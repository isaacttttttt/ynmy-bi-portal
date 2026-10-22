// 类型定义
export interface Report {
  id: string;
  name: string;
  type: "dashboard" | "report" | "form" | "bi" | "frm" | "fvs" | "cpt";
  icon?: string;
  lastOpenTime?: string;
  tags?: string[];
  path?: string;
  isFavorite?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: "folder" | "dashboard";
  icon?: string;
  tags?: string[];
  reportCount?: number;
  children?: Category[];
}

export interface Notice {
  id: string;
  title: string;
  category: string;
  isTop: boolean;
  date: string;
  source: string;
  content?: string;
  url?: string;
}

export interface QuickEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  sortNo: number;
}

export interface ReportDictionary {
  id: string;
  name: string;
  type: "dashboard" | "report" | "form";
  description?: string;
  module: string;
  owner: string;
  updateFrequency: string;
  totalViews: number;
  metrics?: string[];
  status: "active" | "archived";
}

// Mock数据
export const mockWorkbenchData = {
  recent: [
    {
      id: "1",
      name: "集团经营分析总览驾驶舱",
      type: "dashboard" as const,
      lastOpenTime: "2小时前",
      tags: ["驾驶舱", "集团"],
    },
    {
      id: "2",
      name: "财务共享中心月度报表",
      type: "report" as const,
      lastOpenTime: "昨天 16:32",
      tags: ["财务", "月报"],
    },
    {
      id: "3",
      name: "库存周转分析",
      type: "report" as const,
      lastOpenTime: "昨天 09:15",
      tags: ["供应链"],
    },
    {
      id: "4",
      name: "人力成本结构分析",
      type: "form" as const,
      lastOpenTime: "3天前",
      tags: ["人力"],
    },
  ],
  frequent: [
    {
      id: "5",
      name: "销售业绩达成看板",
      type: "dashboard" as const,
      tags: ["销售"],
    },
    {
      id: "6",
      name: "应收账款分析报表",
      type: "report" as const,
      tags: ["财务"],
    },
    {
      id: "7",
      name: "供应链全景驾驶舱",
      type: "dashboard" as const,
      tags: ["供应链"],
    },
    {
      id: "8",
      name: "区域销售排名报表",
      type: "report" as const,
      tags: ["销售"],
    },
  ],
  favorite: [
    {
      id: "9",
      name: "集团经营分析总览驾驶舱",
      type: "dashboard" as const,
      tags: ["驾驶舱"],
    },
    {
      id: "10",
      name: "财务共享中心月度报表",
      type: "report" as const,
      tags: ["财务"],
    },
  ],
};

// 多层级专题分析数据
export const mockThematicData: { [key: string]: Category[] } = {
  root: [
    {
      id: "cat1",
      name: "健康品事业群财务分析驾驶舱",
      type: "dashboard",
      tags: ["驾驶舱", "财务分析"],
      reportCount: 12,
    },
    {
      id: "cat2",
      name: "健康品事业群财务管理驾驶舱",
      type: "dashboard",
      tags: ["驾驶舱", "财务"],
      reportCount: 8,
    },
    {
      id: "cat3",
      name: "BI自助分析驾驶舱",
      type: "dashboard",
      tags: ["驾驶舱", "自助分析"],
      reportCount: 15,
    },
    {
      id: "cat4",
      name: "供应链专题分析",
      type: "folder",
      tags: ["专题", "供应链"],
      reportCount: 20,
    },
    {
      id: "cat5",
      name: "财务专题分析",
      type: "folder",
      tags: ["专题", "财务"],
      reportCount: 18,
    },
    {
      id: "cat6",
      name: "销售专题分析",
      type: "folder",
      tags: ["专题", "销售"],
      reportCount: 25,
    },
  ],
  cat4: [
    {
      id: "cat4-1",
      name: "库存分析驾驶舱",
      type: "dashboard",
      tags: ["供应链", "库存"],
      reportCount: 5,
    },
    {
      id: "cat4-2",
      name: "采购分析驾驶舱",
      type: "dashboard",
      tags: ["供应链", "采购"],
      reportCount: 8,
    },
    {
      id: "cat4-3",
      name: "物流配送分析",
      type: "folder",
      tags: ["供应链", "物流"],
      reportCount: 7,
    },
  ],
  cat5: [
    {
      id: "cat5-1",
      name: "应收账款分析驾驶舱",
      type: "dashboard",
      tags: ["财务", "应收"],
      reportCount: 6,
    },
    {
      id: "cat5-2",
      name: "成本分析驾驶舱",
      type: "dashboard",
      tags: ["财务", "成本"],
      reportCount: 7,
    },
    {
      id: "cat5-3",
      name: "资金管理",
      type: "folder",
      tags: ["财务", "资金"],
      reportCount: 5,
    },
  ],
  cat6: [
    {
      id: "cat6-1",
      name: "区域销售分析驾驶舱",
      type: "dashboard",
      tags: ["销售", "区域"],
      reportCount: 10,
    },
    {
      id: "cat6-2",
      name: "产品销售分析驾驶舱",
      type: "dashboard",
      tags: ["销售", "产品"],
      reportCount: 9,
    },
    {
      id: "cat6-3",
      name: "客户分析",
      type: "folder",
      tags: ["销售", "客户"],
      reportCount: 6,
    },
  ],
  "cat4-3": [
    {
      id: "cat4-3-1",
      name: "运输成本分析报表",
      type: "dashboard",
      tags: ["物流", "成本"],
    },
    {
      id: "cat4-3-2",
      name: "配送时效分析报表",
      type: "dashboard",
      tags: ["物流", "时效"],
    },
  ],
  "cat5-3": [
    {
      id: "cat5-3-1",
      name: "现金流量表",
      type: "dashboard",
      tags: ["资金", "现金流"],
    },
    {
      id: "cat5-3-2",
      name: "资金预测分析",
      type: "dashboard",
      tags: ["资金", "预测"],
    },
  ],
  "cat6-3": [
    {
      id: "cat6-3-1",
      name: "客户画像分析",
      type: "dashboard",
      tags: ["客户", "画像"],
    },
    {
      id: "cat6-3-2",
      name: "客户流失预警",
      type: "dashboard",
      tags: ["客户", "预警"],
    },
  ],
};

export const mockNoticeData: Notice[] = [
  {
    id: "n1",
    title: "云南白药集团数据门户管理办法（试行）",
    category: "管理办法",
    isTop: true,
    date: "2026-09-01",
    source: "通知",
  },
  {
    id: "n2",
    title: "集团经营数据安全与分级授权管理规定",
    category: "管理规定",
    isTop: true,
    date: "2026-08-28",
    source: "通知",
  },
  {
    id: "n3",
    title: "关于规范报表开发及报表提报流程的通知",
    category: "通知",
    isTop: false,
    date: "2026-09-10",
    source: "通知",
  },
  {
    id: "n4",
    title: "2026年第三季度经营分析会材料报送要求",
    category: "工作通知",
    isTop: false,
    date: "2026-09-08",
    source: "通知",
  },
  {
    id: "n5",
    title: "集团 BI 平台驾驶舱限额申报指引（修订版）",
    category: "操作指引",
    isTop: false,
    date: "2026-09-03",
    source: "通知",
  },
];

export const mockQuickEntryData: QuickEntry[] = [
  {
    id: "q1",
    name: "问题反馈",
    description: "使用问题表决通入口",
    url: "#",
    icon: "💬",
    sortNo: 1,
  },
  {
    id: "q2",
    name: "报表需求",
    description: "提交新的报表开发需求",
    url: "#",
    icon: "📊",
    sortNo: 2,
  },
  {
    id: "q3",
    name: "BI自主分析",
    description: "进入数据自助的分析平台",
    url: "#",
    icon: "🔍",
    sortNo: 3,
  },
  {
    id: "q4",
    name: "BI帮助文档",
    description: "help.fanruan.com/finebi",
    url: "https://help.fanruan.com/finebi",
    icon: "📚",
    sortNo: 4,
  },
  {
    id: "q5",
    name: "BI教学视频",
    description: "edu.fanruan.com/video",
    url: "https://edu.fanruan.com/video",
    icon: "🎬",
    sortNo: 5,
  },
];

export const mockReportDictionaryData: ReportDictionary[] = [
  {
    id: "rd1",
    name: "终端数据面板",
    type: "dashboard",
    description: "核心销售数据驾驶舱，提供核心销售指标、渠道、库存等关键业务信息，支持按区/市/县多级下钻。",
    module: "临床经验",
    owner: "张三",
    updateFrequency: "实时",
    totalViews: 1250,
    metrics: ["终端销售", "数据质量", "商业库存", "达成率"],
    status: "active",
  },
  {
    id: "rd2",
    name: "实时流向数据（区域）",
    type: "report",
    description: "按区域维度展现出货信息，支持按区/市/县多级下钻，查询各环节库存分布。",
    module: "临床经验",
    owner: "李四",
    updateFrequency: "实时",
    totalViews: 980,
    metrics: ["区域流向", "省区达成", "地市明细"],
    status: "active",
  },
  {
    id: "rd3",
    name: "DMS采集经销商库存",
    type: "report",
    description: "DMS系统采集的经销商存货库存，用于摸底库存分布情况、支持库存/品牌/品类等多维分析，支持按不同省区市多级下钻。",
    module: "供应链",
    owner: "王五",
    updateFrequency: "每日",
    totalViews: 2100,
    metrics: ["渠道库存", "周转天数", "库存预警", "转化率"],
    status: "active",
  },
  {
    id: "rd4",
    name: "各渠道销售情况汇总",
    type: "report",
    description: "各渠道销售情况汇总，含线上渠道、线下终端、流通渠道等维度对比分析。",
    module: "财务管理",
    owner: "赵六",
    updateFrequency: "T+1",
    totalViews: 1560,
    metrics: ["渠道销售额", "达成率", "同比增长"],
    status: "active",
  },
  {
    id: "rd5",
    name: "生产批下达情况",
    type: "form",
    description: "生产批下达状态监控，合计如今批次统计，产能利用分析，支持车间拆分。",
    module: "生产制造",
    owner: "孙七",
    updateFrequency: "实时",
    totalViews: 450,
    metrics: ["计划下达", "商业库存", "达成率", "产能利用"],
    status: "active",
  },
  {
    id: "rd6",
    name: "终端数据面板",
    type: "dashboard",
    description: "终端销售数据可视化分析驾驶舱，销售指标、运营主题、销量明细汇总。",
    module: "电商",
    owner: "周八",
    updateFrequency: "T+1",
    totalViews: 3200,
    metrics: ["终端销售", "数据质量", "广告费用", "ROI", "曝光量", "转化率"],
    status: "active",
  },
  {
    id: "rd7",
    name: "EBS+销售系统",
    type: "report",
    description: "EBS+销售系统营收报表。",
    module: "财务管理",
    owner: "张三",
    updateFrequency: "实时",
    totalViews: 800,
    metrics: ["渠道销售额", "达成率"],
    status: "active",
  },
  {
    id: "rd8",
    name: "生产智慧系统",
    type: "dashboard",
    description: "生产计划管理看板，支持产能和工单管理分析。",
    module: "生产制造",
    owner: "李四",
    updateFrequency: "T+1",
    totalViews: 620,
    metrics: ["生产管理"],
    status: "active",
  },
  {
    id: "rd9",
    name: "应收账款分析报表",
    type: "report",
    description: "分析应收账款账龄分布，逾期账款统计，支持按客户和地区分析。",
    module: "财务管理",
    owner: "王五",
    updateFrequency: "T+1",
    totalViews: 1450,
    metrics: ["应收账款", "账龄分析", "逾期率"],
    status: "active",
  },
  {
    id: "rd10",
    name: "库存周转分析",
    type: "report",
    description: "库存周转天数分析，呆滞库存预警，支持SKU级别的明细查询。",
    module: "供应链",
    owner: "赵六",
    updateFrequency: "T+1",
    totalViews: 1120,
    metrics: ["周转天数", "库存金额", "呆滞预警"],
    status: "active",
  },
  {
    id: "rd11",
    name: "人力成本结构分析",
    type: "dashboard",
    description: "人力成本构成分析，人效指标监控，支持部门和岗位维度分析。",
    module: "运营",
    owner: "孙七",
    updateFrequency: "月更新",
    totalViews: 340,
    metrics: ["人力成本", "人效", "编制"],
    status: "active",
  },
  {
    id: "rd12",
    name: "集团经营分析总览",
    type: "dashboard",
    description: "集团整体经营情况总览，包含收入、利润、现金流等核心指标。",
    module: "财务管理",
    owner: "周八",
    updateFrequency: "T+1",
    totalViews: 5200,
    metrics: ["营业收入", "净利润", "现金流", "ROE"],
    status: "active",
  },
];
