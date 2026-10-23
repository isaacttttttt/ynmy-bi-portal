import type { Bootstrap, Entry, Notice, Report } from './portal-model';

const samples = [
  ['集团经营分析总览驾驶舱', 'fvs', '运营', '健康品事业群', '经营管理部', '集团核心指标总览与趋势分析', '经营收入,毛利率,预算达成率'],
  ['财务共享中心月度报表', 'cpt', '财务管理', '财务共享中心', '财务管理部', '货证处理量、时效与差错率统计', '处理量,及时率,差错率'],
  ['库存周转分析', 'cpt', '供应链', '供应链中心', '供应链管理部', '库存周转天数与呆滞结构分析', '库存金额,周转天数,库龄'],
  ['人力成本结构分析', 'frm', '运营', '人力资源中心', '人力资源部', '人工成本构成与人均效能对标', '人工成本,人均产出,编制'],
  ['销售业绩达成看板', 'fvs', '临床经营', '临床一部', '销售管理部', '分区域、渠道追踪销售目标达成', '终端纯销,达成率,同比增长'],
  ['应收账款分析报表', 'cpt', '财务管理', '财务共享中心', '财务管理部', '账龄结构、客户回款与风险监控', '应收余额,逾期金额,回款率'],
  ['供应链全景驾驶舱', 'fvs', '供应链', '供应链中心', '供应链管理部', '采购、生产、仓储与物流监控', '交付及时率,库存金额,采购成本'],
  ['区域销售排名报表', 'cpt', '临床经营', '临床二部', '销售管理部', '省区销售规模、增长与人效排名', '销售额,增长率,人均销售'],
  ['健康品事业群经营分析驾驶舱', 'fvs', '运营', '健康品事业群', '经营管理部', '健康品经营指标与渠道表现分析', '收入,利润,渠道贡献'],
  ['健康品事业群财务管理驾驶舱', 'fvs', '财务管理', '健康品事业群', '财务管理部', '经营预算、成本与现金流分析', '预算执行,成本,现金流'],
  ['BI自助分析驾驶舱', 'bi', '运营', '健康品事业群', '数据管理部', '探索销售数据与业务指标', '销售额,达成率,同比环比'],
  ['终端数据面板', 'bi', '临床经营', '临床一部', '销售管理部', '覆盖终端纯销、流向、库存等关键经营指标，支持省区及地市多级下钻', '终端纯销,数据流向,商业库存,达成率'],
  ['生产批下达情况', 'cpt', '生产制造', '生产中心', '生产管理部', '跟踪生产批下达执行，支持车间、品种与批次下钻', '计划下达,商业库存,达成率'],
  ['终端数据面板', 'bi', '电商', '电商事业部', '电商运营部', '整合平台投放、订单和转化数据，支持按品牌、渠道、时间维度灵活筛选', '广告费用,ROI,曝光量,转化率'],
  ['历史渠道销售月报', 'cpt', '临床经营', '临床二部', '销售管理部', '历史口径归档，仅用于回溯查询', '渠道销售额,达成率,同比环比'],
  ['实时流向数据（区域）', 'cpt', '临床经营', '临床销售', '销售管理部', '按区域维度展示实时流向数据，支持省区及地市多级下钻，覆盖全国各省区销售流向明细', '区域流向,省区达成,地市明细'],
  ['DMS采集经销商库存', 'frm', '供应链', '供应链', '供应链管理部', 'DMS系统采集的经销商库存数据，用于渠道库存监控、补货决策和库存周转分析，支持按经销商、品种、仓库多维度查看', '渠道库存,周转天数,库存预警'],
  ['各渠道销售情况表', 'cpt', '运营', '运营', '经营管理部', '各渠道销售情况汇总，含发货口径和财报口径对比分析，支持按渠道、产品、区域多维交叉', '渠道销售额,达成率,同比环比'],
] as const;
const parents = ['clinical', 'finance', 'supply', 'production', 'clinical', 'finance', 'supply', 'region', 'health', 'health', 'health', 'clinical', 'production', 'sales', 'clinical', 'clinical', 'supply', 'sales'];
export const reports: Report[] = samples.map((r, i) => ({
  id: `entry-${i + 1}`, metadataId: `${1001 + i}`, parentId: parents[i], name: r[0], type: r[1], sort: i,
  templateId: r[1] === 'bi' ? `publish-${i + 1}` : undefined,
  description: r[5], module: r[2], department: r[3], owner: ['张兆', '李泰达', '段青青', '李雨'][i % 4], developer: '数据开发组（示例）',
  source: ['分销系统（智链）', 'EBS + 财务系统', 'DMS经销商管理系统', '数据中台'][i % 4],
  frequency: ['实时', 'T+1', '周更新', '月更新'][i % 4], status: i === 14 ? 'archived' : 'active',
  metrics: r[6].split(','), views: [2180, 880, 1000, 99, 3200, 500, 2100, 340, 650, 100, 300, 1600, 62, 740, 45, 890, 430, 720][i],
  visits30d: [12, 30, 9, 3, 28, 8, 18, 7, 5, 4, 2, 10, 1, 6, 0, 9, 4, 8][i],
  lastVisitedOn: i < 8 ? `2026-10-${22 - i}` : null, updatedOn: '2026-10-22',
  useScene: '示例：用于业务经营例会与日常指标跟踪。正式说明由报表负责人维护。',
  calcLogic: '示例数据不包含正式指标口径，接入后展示底表维护的计算逻辑。',
}));
const folder = (id: string, parentId: string | null, name: string, sort: number): Entry => ({ id, parentId, name, sort, type: 'folder' });
export const bootstrap: Bootstrap = {
  user: { name: '演示用户' }, rootId: 'topics', dataAsOf: '2026-10-22', favoriteIds: ['entry-2', 'entry-9', 'entry-10'],
  entries: [folder('topics', null, '专题分析', 0), folder('health', 'topics', '健康品事业群', 0), folder('clinical', 'topics', '临床事业群', 1), folder('production', 'topics', '药品事业群', 2), folder('supply', 'health', '供应链专题分析', 100), folder('finance', 'health', '财务专题分析', 101), folder('sales', 'health', '销售专题分析', 102), folder('region', 'sales', '区域销售', 1), ...reports.map(({ id, parentId, name, type, templateId, sort }) => ({ id, parentId, name, type, templateId, sort }))],
  quickEntries: [
    { id: 'feedback', name: '问题反馈', description: '使用报表过程中的问题反馈入口', url: null },
    { id: 'request', name: '报表需求', description: '提交新的报表开发需求', url: null },
    { id: 'self', name: 'BI自主分析', description: '进入帆软自助分析平台', url: null },
    { id: 'help', name: 'BI帮助文档', description: '平台操作与使用指南', url: 'https://help.fanruan.com/finebi' },
    { id: 'video', name: 'BI教学视频', description: '学习报表与分析方法', url: 'https://edu.fanruan.com/video' },
  ],
};
export const notices: Notice[] = ['云南白药集团数据门户管理办法（试行）', '集团经营数据安全与分级授权管理规定', '关于规范报表开发需求提报流程的通知', '2026年第三季度经营分析例会材料报送要求', '集团 BI 平台账号权限申请指引（修订版）', '报表字典维护说明'].map((title, i) => ({
  id: `notice-${i + 1}`, title, category: ['管理办法', '管理规定', '通知', '工作通知', '操作指引', '操作指引'][i],
  pinned: i < 2, publishedOn: `2026-10-${20 - i}`,
  content: '此公告为界面演示数据，不是正式发布的制度。\n\n接入后展示公告底表中的正文、发布日期及链接。公告列表和详情均由后台依据当前用户的目录权限过滤。',
}));
