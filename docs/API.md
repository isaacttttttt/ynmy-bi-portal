# 数据门户接口契约 v1

本契约由 `backend/src/app.js` 实现。本次将入口迁移至 `/portal/`，部署时需同时更新前后端镜像及代理配置；文档不代表线上环境已更新。部署、数据库适配和验收方法见 [正式部署指南](../deploy/README.md)。

## 接入约定

- 基础路径：`/portal/api/portal/v1`，通过 `NEXT_PUBLIC_PORTAL_API_BASE` 指定。
- 前端静态导出，由帆软页面以 iframe 嵌入。推荐门户、BFF、帆软通过反向代理同源部署。
- 身份来自服务端验证的当前平台会话。请求使用 `credentials: include`，不接收浏览器自报的 `userId` 或权限集合。不把平台 token 写入 URL、localStorage 或日志。
- 客户的 `trusted-cookie` 模式沿用主平台校验：`fine_login_users` 对应 `dim_bi_user.id`；包含多个 ID 时，用当前 token 的 `sub` 匹配其中用户的 `username`。访问记录通过 `dim_bi_visit_log.user_code = dim_bi_user.username` 查询。
- 写请求须由 BFF 校验同源 Origin / CSRF，CORS 不得使用通配来源并允许携带凭据。
- ID 均为字符串：`Entry.id` 是帆软目录/模板入口 ID；`Report.metadataId` 是底表自增主键，不能混用。BI 的 `templateId` 是发布任务 ID，不是入口 ID。
- 日期使用 `YYYY-MM-DD`，精确时间若以后提供则使用带时区的 ISO 8601。业务日期以 Asia/Shanghai 计算。不存在的日期返回 `null`，不可伪造时间。
- 所有响应 `Cache-Control: private, no-store`。不要跨用户复用权限数据缓存。
- 前端只在当前页面会话内缓存列表，首次读取后每10分钟静默刷新当前数据；工作台三类列表一并缓存，切换 Tab 不发请求。临时网络错误保留最后一次成功结果，401/403 清除对应缓存并显示错误。浏览器缓存不替代服务端鉴权。

成功响应：

```json
{"success":true,"data":{"items":[],"total":0,"page":1,"pageSize":6}}
```

失败响应：

```json
{"success":false,"error":{"code":"SESSION_EXPIRED","message":"登录已过期，请重新登录"},"requestId":"trace-id"}
```

HTTP 400 参数不合法；401 登录失效；403 资源无权访问；404 不存在（也可统一隐藏无权资源）；502 帆软上游失败；503 底表服务不可用。不要返回 SQL、堆栈或凭据。前端显示可读错误与重试入口。

## 权限处理顺序

每次请求解析当前会话并确认用户状态。BFF 按 token 摘要缓存 `/v10/view/entry/tree` 的目录和授权 ID，默认 60 秒；同一会话并发获取时共用一次平台请求。到期后重新获取，失败则拒绝请求，不使用过期目录或管理员身份回退。不同会话、不同门户节点的缓存独立。

1. 基于 tree 的实际返回项构造可见入口 ID 集合。拿到目录本身不等于得到所有未返回子项的权限。
2. 最近、常用、收藏与此集合取交集。报表字典以 `dim_bi_report_dictionary` 为主表，LEFT JOIN `dim_bi_report_info_dtl`，根据 `report_id` 是否在此集合中标记 `granted/denied`，未授权字典记录也展示。专题仅返回配置的 `rootId` 下已授权的所有层级。权限集合必须来自完整授权树，不能只用专题子树过滤全站公告和字典。
3. 客户底表模式的公告使用当前 username 定位启用的 `dim_bi_user`，再按 `oa_dept_code = dim_dept_mapping.dept_job_id` INNER JOIN。映射得到的 `dept_name` 与公告 `notice_dept_name` 拆分后的部门名称精确匹配；不依赖 tree 权限。重复部门映射不重复返回公告。
4. 公告同时检查生效时间、过期时间；置顶不绕过权限和有效期。日期边界需使用上海业务日，结束日当天包含在内。
5. 搜索下拉层仍只检索授权报表；字典页的检索、筛选计数、排序和分页覆盖字典全部记录，可按权限状态筛选。单条打开、收藏写入也必须重新鉴权。

## GET /bootstrap

返回登录上下文、按角色配置的专题目录树（`thematicRoles`）、收藏 ID、启用的快捷入口与数据日期。专题分析数据链路为 `dim_bi_user.role_id` → `portal_role_thematic_config` / `portal_role_thematic_node`（仅返回启用节点，报表节点与帆软当前用户权限树 `tree` 取交集并补齐 `templateId`/`url`/`iconUrl`）。树是扁平结构，父子关系用 ID，顶级节点 `parentId` 为 `null`。首页专题分析支持在标题栏及面包屑中直接切换角色并逐级下钻目录；未配置角色或目录为空显示空态。

```json
{
  "success": true,
  "data": {
    "user": {"name":"当前用户"},
    "rootId":"",
    "dataAsOf":"2026-10-22",
    "favoriteIds":["entry-123"],
    "entries":[],
    "thematicRoles":[
      {
        "id":"role-health",
        "name":"健康品分析角色",
        "entries":[
          {"id":"node-folder-1","parentId":null,"name":"核心专题","type":"folder","sort":0},
          {"id":"entry-123","parentId":"node-folder-1","name":"经营分析","type":"bi","templateId":"publish-task-id","sort":0}
        ]
      }
    ],
    "quickEntries":[{"id":"help","name":"BI帮助文档","description":"平台操作与使用指南","url":"https://help.fanruan.com/finebi"}]
  }
}
```

## 角色专题目录配置接口（独立挂载页 `/portal/role-thematic-config/`）

独立功能页通过 `/portal/role-thematic-config/` 挂载到帆软主平台，由主平台自身权限控制入口可见性。接口继续复用同源会话鉴权，并通过帆软 `/v10/roles?privilegeType=2` 校验当前账号仅可配置自己有管理权限的角色。

| 请求 | 参数 | 说明 |
| --- | --- | --- |
| `GET /role-thematic/roles` | `page=1`, `pageSize=15` (1–50), `q` | 代理帆软 `/v10/roles`（附加 `privilegeType=2` 与时间戳 `_`），平铺分页返回角色及已配置统计 |
| `GET /role-thematic/roles/:roleId` | `roleName` (可选检索提示) | 返回该角色的配置主信息（`role`）、已有目录报表树（`nodes`）及底表 `dim_bi_role_report_rel` LEFT JOIN `dim_bi_report_info_dtl` 的可配置报表（`availableReports`） |
| `POST /role-thematic/roles/:roleId/tree` | JSON: `{roleName?, nodes: [...]}` | 校验同源 Origin、角色管理权限、树结构合法性（无环、深度≤10、同角色报表不重复、报表属于该角色底表）后，在单个数据库事务内保存配置并返回最新详情 |

`Entry.type` 枚举：`folder | bi | fvs | frm | cpt | url`。`iconUrl` 可选，提供 HTTPS 图片地址。`url` 类型必须提供 `url`。图标请求失败使用类型默认切图。`sort` 数值升序，事业群默认选择根目录下排序第一的文件夹；目录为空显示空态，不伪造事业群。

快捷入口不按用户、部门或 tree 做行权限过滤，只返回 `fr_quick_entry_app.status=1`，按 `sort_no` 升序、`app_id` 升序排列。

快捷入口 `url:null` 表示尚未配置，前端显示“待配置”，不链接到不存在的本地页面。只接受 HTTP(S)；内网站点相对路径按门户同源解析。BFF 应校验业务允许的链接来源。

快捷入口 `iconUrl` 来自 `fr_quick_entry_app.icon_url`，为空时使用本地默认图标；有值时先显示默认图标，再懒加载指定 URL，失败后保留默认图标。

## GET /reports

| 参数 | 类型 / 默认值 | 规则 |
| --- | --- | --- |
| q | string / 空 | 去前后空格，最多200字符；检索名称、描述、指标、Owner、数据源；英文忽略大小写 |
| category | string / all | `all` 综合检索报表、业务模块和指标；`report` 按上述字段检索；`tag` 只查业务模块；`metric` 只查 core_metrics |
| organization | 重复 query 参数 | 所属组织，取 `report_owner_dept`，空值显示“暂未维护” |
| permission | 重复 query 参数 | `granted`（有访问权限）、`denied`（无访问权限）；默认同时展示 |
| status | 重复 query 参数 | `active`、`archived` |
| frequency | 重复 query 参数 | `实时`、`T+1`、`周更新`、`月更新`；底表其他值须规范化 |
| volume | 重复 query 参数 | `high`：>1000，`medium`：100–1000，`low`：<100；均为累计访问量 |
| page | 正整数 / 1 | 非整数、负数返回400 |
| pageSize | 正整数 / 6 | 1–100 |

所属组织使用 `dim_bi_report_dictionary.business_group`，映射为 `Report.businessGroup`；Owner 部门仍使用 `belonging_department`。

同组多选 OR，组间 AND；空数组表示不限。默认无筛选。默认按元数据 `sort_no`、`metadataId` 稳定排序。切换搜索或筛选，前端重置第一页；搜索和筛选保存在 URL，支持刷新和浏览器前后退。

`data` 包含 `items: Report[]`、`total`、`page`、`pageSize`、`facets`。`facets` 的五个键与筛选键相同，每组是 `{value:string,count:number}[]`。计数应用关键词和其他组条件，忽略本组条件，保留计数为0的可见选项。总数计算应用所有条件。

正式底表的访问统计查询超时时，`/reports` 仍返回字典元数据及其他筛选结果，设置 `visitStatsUnavailable: true`、`views: null` 和 `facets.volume: []`。本次响应暂停应用 `volume` 条件，统计恢复后再次请求即恢复该条件。若 `/bootstrap` 读访问日志截止日超时，`dataAsOf` 返回 `null`，其余初始化数据正常返回。

Report 示例（卡片和详情使用同一对象，避免底表未就绪时增加空的详情接口）：

```json
{
  "id":"entry-123","metadataId":"1001","parentId":"health","name":"经营分析",
  "type":"bi","templateId":"publish-task-id","sort":1,
  "description":"报表介绍","module":"运营","businessGroup":"健康品事业群","department":"经营管理部",
  "owner":"业务负责人","developer":"开发负责人","developerDepartment":"数据开发部",
  "permission":"granted","onlineOn":null,"updateNote":"","frequency":"T+1","status":"active",
  "source":"ERP + 财务系统","metrics":["销售额","达成率"],
  "views":1000,"visits30d":12,"lastVisitedOn":"2026-10-22",
  "useScene":"经营例会","calcLogic":"底表维护的计算口径","updatedOn":"2026-10-22"
}
```

详情以右侧抽屉展示，依次为报表说明（useScene）、报表简介（description）、核心指标、数据来源（source、calcLogic）、管理信息。`onlineOn` 来自 `online_date`，`updateNote` 来自 `last_update_note`；`developerDepartment` 来自 `dev_owner_dept`。缺失值显示“暂未维护”，不以最近更新日期冒充上线时间。

归档报表可以查元数据，字典禁用打开按钮；后端将其排除在工作台之外并拒绝新增收藏。平台专题来自 tree，元数据归档不会自动撤销平台权限；正式停用报表时须同时下架平台入口或撤销权限，防止从其他入口打开。没有正式口径的字段返回空字符串，不自动生成业务口径。

## GET /search

参数 `category=all|report|tag|metric`（默认 all）、`q`（默认空，最多200字符）。先检查权限，再从在用报表中搜索，单类最多返回20项及匹配总数；综合按报表、标签、指标顺序合并各类结果，最多60项。标签对应 `business_module`，指标对应 `core_metrics`，不新增独立标签模型。

`data` 为 `{items:[{category,value,subtitle,report?}],total}`。报表项带完整 `Report`，可调用平台打开；标签、指标项去重，subtitle 给出当前授权范围内的相关报表数。点击标签或指标后，前端携带 q、category 进入字典。输入为空时，下拉层直接从工作台 recent 缓存提取最近报表及其标签、指标；不显示“猜你想搜”。

## 搜索历史

| 请求 | 参数 | 成功 data |
| --- | --- | --- |
| GET /search-history | query: `category=all|report|tag|metric` | `{items:[{query,searchedAt}]}` |
| POST /search-history | JSON: `{"category":"report","query":"经营分析"}` | 当前类别最新 items |
| POST /search-history/clear | query: `category=all|report|tag|metric` | `{items:[]}` |

用户身份只取已验证会话，不能传 userId。读、写、清空均限定当前用户和类别；POST 校验同源 Origin。仅确认搜索、点击历史或选择结果时保存，不记录每次键入。关键词最多200字符，空白折叠并去首尾空白，空词拒绝保存；英文忽略大小写去重，重复搜索更新显示文本和时间。每人每类保留最近20条。`searchedAt` 为 UTC ISO 8601，按时间降序、标准化关键词升序稳定排序。

表 `portal_search_history` 在 `backend/sql/003-search-history.sql` 定义。主键 `(user_code,category,query_key)` 负责去重；索引 `(user_code,category,searched_at DESC,query_key)` 支持最近列表、清空和保留条数查询。请求日志包含搜索参数，token、Cookie 值及密码字段不落盘。`PORTAL_LOG_FILE` 指定 JSON 行日志文件，未配置则输出到容器标准输出。失败日志包含接口、方法、requestId、错误码、具体原因和调用堆栈；PostgreSQL 提供表、列或约束名称时一并记录。标准 Compose 将文件挂载到部署目录的 `logs/portal.log`。业务底表账号只对此表额外获得读写权限，其余业务表仍只读。

## GET /workbench

参数：`tab=recent|frequent|favorites`、`page=1`、`pageSize=8`（默认，允许1–100）。返回 `Page<Report>`，不带 facets。前端使用 `GET /workbench/snapshot` 一次读取 `{recent,frequent,favorites}`，每10分钟静默更新；切换标签使用缓存。最近打开、我常用的各最多8条，显示为两行四列；收藏保留全部并支持内部滚动。

- recent：当前用户、在用且有权限的报表；按最近访问日降序，日期相同时用入口 ID 稳定排序，取前8条。
- frequent：当前用户近30个自然日的访问量降序；以 `SUM(visit_num)` 聚合，不能 `COUNT(*)` 数日汇总行数。次数相同时按入口 ID 排序，取前8条，并注明数据截止日。
- favorites：平台收藏列表与权限、在用报表取交集。缺少元数据的收藏需要底表补齐后才能进入当前工作台；专题收藏仍然以平台入口 ID 保存。

当前底表只有日粒度，前端展示访问日期，不显示“几小时前”。若以后要展示分钟级，ETL 必须保留真实 `last_visited_at`。

## POST /favorites/:entryId

```json
{"favorite":true}
```

成功 `data`：`{"id":"entry-123","favorite":true,"report":{...}}`。`report` 是当前授权报表的完整 `Report` 对象；入口没有报表元数据时返回 `null`。它用于立即更新“我收藏的”缓存，无需再读取工作台。前端只在服务端确认后修改状态，失败保留原值；请求期间锁定该入口的收藏按钮。首页、专题、字典共享状态。该契约是设置目标状态，BFF 应使重复请求幂等。

参考工程确认的上游调用：

- 列表：`GET /v10/favorite/entry/list`
- 添加：`POST /v10/favorite/entry/:id`
- 取消：`POST /v10/favorite/entry/:id?fakeMethod=DELETE`
- 示例成功标记：响应 `data === "success"`。上线时仍须核对部署版本，不能只以 HTTP 200 判断成功。

收藏也建议通过 BFF 适配平台差异；浏览器不直接读取父窗口的 `fine_auth_token`。

## GET /notices

参数 `page`、`pageSize`（首页5，全部公告10）；返回 `Page<Notice>`。

```json
{"id":"notice-123","title":"标题","category":"通知","pinned":true,"publishedOn":"2026-10-22","content":"正文纯文本","url":"https://example.internal/notice"}
```

先按权限和有效期筛选，再按置顶降序、发布日期降序、ID升序排序。正文按纯文本换行渲染，不使用 `dangerouslySetInnerHTML`。若业务要求富文本，须另外明确清洗规范。列表已包含正文，详情弹窗不发送无鉴权的旁路请求。

## 平台打开接口

根据 `categoryview_0521/src/app/page.js` 中的实际调用封装在 `src/lib/portal-api.ts`：

| 类型 | 打开方式 |
| --- | --- |
| bi | `window.top.BI.Services.getService('dec.service.frame.tab_pane').openCustomTab(name,id,'bi.subject.publink',{subjectEntryType:2,publishTaskId:templateId,entryId:id,hideType:'display'})` |
| frm / fvs / cpt | `window.top.FS.tabPane.addItem({title:name,src:FINE_BASE+'/v10/entry/access/'+encodeURIComponent(id)})` |
| url | `window.top.FS.tabPane.addItem({title:name,src:validatedUrl})` |
| folder | 门户内按 parentId 下钻 |

同源读取父窗口失败、平台 API 缺失或 BI 发布任务 ID 缺失时显示错误，不能宣称已打开。跨域 iframe 不能直接调用 `window.top` 的平台对象；若必须跨域，需要由平台方提供有来源校验的桥接协议后再实现，不使用 `postMessage('*')` 猜测协议。平台打开仍需平台自身鉴权。

## 与底表同事的交接

| 当前设计问题 | 需要提供或确认 |
| --- | --- |
| `report_metadata.report_id` 是自增数字，平台入口 ID 是字符串 | 增加唯一 `fine_entry_id` / 关联表；`permission_code` 只有明确等同入口 ID 时才能用；开发路径不能当稳定主键 |
| BI 发布任务 ID 不在元数据表中 | 由 tree 的 `templateId` 传递，不使用 `report_id` 代替 |
| `dim_bi_visit_log` 为日汇总、只有 `visit_num` | SUM聚合访问量，最近只展示日粒度；近30日统计需至少30日可查询历史（示例 lifecycle 3 不足） |
| DDL 名称 `dim_bi_visit_log` 与 INSERT 的 `dim_bi_visit_log_inc` 不同 | 确定最终服务表名、刷新日期、粒度与迟到数据处理方式 |
| 日志和目录原 DDL 为 ORC/Hive | 将查询所需底表同步到 PostgreSQL，当前 pg 驱动不直接查询 ORC |
| 快捷入口索引引用未定义的 `is_deleted` | 补字段或移除索引项，启用状态与逻辑删除规则一致 |
| `collect_list` 生成路径的顺序不稳定 | 按目录深度重建有序路径；前端仍以 ID 父子关系为准 |
| 公告权限是逗号字符串，日期也是字符串 | 精确拆分 ID；统一日期格式、空范围默认不公开，确认是否需要全员标记 |

权限来源是帆软当前用户树，默认缓存最多 60 秒，权限变更及会话撤销可能有相应延迟；T+1 元数据、访问日志不得作为权限依据。`FINE_TREE_CACHE_TTL_SECONDS=0` 可关闭持续缓存，保留并发请求合并。缓存同时受 `FINE_TREE_CACHE_MAX_MB`（每节点默认 512 MiB 序列化数据）限制；`FINE_TREE_CACHE_MAX_ENTRIES` 默认 0，不额外限制会话数量，正整数则增加数量限制；超限淘汰最久未使用的会话，单份超限则只返回、不缓存。
