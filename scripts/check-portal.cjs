// A small check of the actual query, mock transport and platform opening paths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
const { emptyFilters, queryReports, volume, descendants, breadcrumb, safeUrl, searchCategories, searchCatalog, validateRoleThematicNodes, folderAccessState, moveRoleThematicNode, isDescendantNode, roleThematicBreadcrumb, attachmentExtension, attachmentPreviewKind, buildAttachmentPreviewUrl } = require('../src/lib/portal-model.ts');
const { reports, bootstrap } = require('./fixtures/portal-fixtures.ts');
const query = (q = '', filters = emptyFilters(), page = 1) => queryReports(reports, { q, filters, page, pageSize: 6 });
assert.equal(query(' ROI ').items[0].module, '电商');
assert(query('张兆').items.every(r => r.owner === '张兆'));
assert(query('EBS').items.every(r => r.source.includes('EBS')));
assert.equal(query('没有这个报表').total, 0);
const filters = { ...emptyFilters(), organization: ['供应链中心', '财务共享中心'], status: ['active'], frequency: ['T+1'] };
assert(query('', filters).items.every(r => filters.organization.includes(r.department) && r.status === 'active' && r.frequency === 'T+1'));
assert.equal(query('').items.length, 6);
assert.notEqual(query('', emptyFilters(), 2).items[0].id, query('').items[0].id);
assert.deepEqual([99,100,1000,1001].map(volume), ['low','medium','medium','high']);
const supply = query('', { ...emptyFilters(), organization: ['供应链中心'] });
assert.equal(supply.facets.organization.find(v => v.value === '财务共享中心').count, reports.filter(r => r.department === '财务共享中心').length);
const sample = [
  { ...reports[0], name: 'Sample A', businessGroup: '甲', status: 'active', permission: 'granted', metrics: ['SKU', 'SKU'] },
  { ...reports[0], name: 'Sample B', businessGroup: '乙', status: 'active', permission: 'granted', metrics: ['SKU'] },
  { ...reports[0], name: 'Sample C', businessGroup: '丙', status: 'archived', permission: 'denied', metrics: ['SKU'] },
  { ...reports[0], name: '其他', businessGroup: '丁', status: 'active', permission: 'granted', metrics: [] },
];
const crossFacets = queryReports(sample, { q: 'sample', filters: { ...emptyFilters(), organization: ['甲'], status: ['active'], permission: ['granted'] }, page: 1, pageSize: 6 });
assert.deepEqual(crossFacets.items.map(r => r.name), ['Sample A']);
assert.deepEqual(crossFacets.facets.organization, [
  { value: '甲', count: 1 }, { value: '乙', count: 1 }, { value: '丙', count: 0 }, { value: '丁', count: 0 },
]);
const sku = searchCatalog(sample, 'all', ' sku ');
assert.deepEqual(sku.items.map(item => [item.category, item.value]), [['report', 'Sample A'], ['report', 'Sample B'], ['metric', 'SKU']]);
assert.equal(sku.items.at(-1).subtitle, '2 份相关报表');
assert.deepEqual(breadcrumb(bootstrap.entries, 'region', 'topics').map(e => e.id), ['health','sales','region']);
assert(descendants(bootstrap.entries, 'health').some(e => e.id === 'entry-8'));
assert(!descendants(bootstrap.entries, 'health').some(e => e.id === 'entry-12'));
assert.equal(descendants([{ id:'a',parentId:'b' },{ id:'b',parentId:'a' }], 'a').length, 1);
// Role-thematic tree model checks
const validTree = validateRoleThematicNodes([
  { id: 'f1', parentId: null, nodeType: 'folder', reportId: null, name: '一级目录', sort: 2, enabled: true },
  { id: 'f2', parentId: 'f1', nodeType: 'folder', reportId: null, name: '二级目录', sort: 0, enabled: true },
  { id: 'r1', parentId: 'f2', nodeType: 'report', reportId: 'rep-1', name: '报表1', sort: 1, enabled: true },
  { id: 'r2', parentId: 'f2', nodeType: 'report', reportId: 'rep-2', name: '报表2', sort: 0, enabled: false },
]);
assert.equal(validTree.ok, true);
assert.equal(validTree.nodes.find(n => n.id === 'r2').sort, 0);
assert.equal(validTree.nodes.find(n => n.id === 'r1').sort, 1);
assert.equal(folderAccessState(validTree.nodes, 'f1'), 'partial');
assert.equal(folderAccessState(validTree.nodes, 'f2'), 'partial');
assert.equal(isDescendantNode(validTree.nodes, 'f1', 'r1'), true);
assert.equal(isDescendantNode(validTree.nodes, 'f2', 'f1'), false);
const moved = moveRoleThematicNode(validTree.nodes, 'r1', 'f1', 'inside');
assert.equal(moved.find(n => n.id === 'r1').parentId, 'f1');
assert.equal(folderAccessState(moved, 'f2'), 'none');
assert.equal(folderAccessState(moved, 'f1'), 'partial');
// Prevent dropping folder into its own descendant
assert.deepEqual(moveRoleThematicNode(validTree.nodes, 'f1', 'f2', 'inside'), validTree.nodes);
// Reject cycle and duplicate reportId
assert.equal(validateRoleThematicNodes([
  { id: 'a', parentId: 'b', nodeType: 'folder', reportId: null, name: 'A', sort: 0, enabled: true },
  { id: 'b', parentId: 'a', nodeType: 'folder', reportId: null, name: 'B', sort: 0, enabled: true },
]).ok, false);
assert.equal(validateRoleThematicNodes([
  { id: 'n1', parentId: null, nodeType: 'report', reportId: 'dup', name: 'R1', sort: 0, enabled: true },
  { id: 'n2', parentId: null, nodeType: 'report', reportId: 'dup', name: 'R2', sort: 1, enabled: true },
]).ok, false);
assert.deepEqual(roleThematicBreadcrumb([
  { id: 'f1', parentId: null, name: '一级', type: 'folder', sort: 0 },
  { id: 'f2', parentId: 'f1', name: '二级', type: 'folder', sort: 0 },
], 'f2').map(e => e.id), ['f1', 'f2']);
assert.throws(() => safeUrl('javascript:alert(1)'));
assert.throws(() => safeUrl('data:text/html,unsafe'));
// Attachment preview classification checks
assert.equal(attachmentExtension('月度汇报.DOCX', '/files/1'), 'docx');
assert.equal(attachmentExtension('附件', '/files/guide.pptx?t=123'), 'pptx');
assert.equal(attachmentPreviewKind('架构图.png', '/files/1'), 'image');
assert.equal(attachmentPreviewKind('制度.pdf', '/files/1'), 'pdf');
assert.equal(attachmentPreviewKind('制度.docx', '/files/1'), 'docx');
assert.equal(attachmentPreviewKind('台账.xlsx', '/files/1'), 'xlsx');
assert.equal(attachmentPreviewKind('旧表.xls', '/files/1'), 'xlsx');
assert.equal(attachmentPreviewKind('汇报.pptx', '/files/1'), 'pptx');
assert.equal(attachmentPreviewKind('旧版.ppt', '/files/1'), 'unsupported');
assert.equal(buildAttachmentPreviewUrl('/files/a.docx', '制度.docx'), '/portal/attachment-preview/?url=%2Ffiles%2Fa.docx&name=%E5%88%B6%E5%BA%A6.docx');
assert(searchCatalog(reports, 'report', '').items.every(item => item.report.status === 'active'));
assert.equal(searchCatalog(reports, 'metric', 'roi').items[0].value, 'ROI');
assert.deepEqual([...searchCategories], ['all','report','metric','tag']);
const combined = searchCatalog(reports, 'all', '');
assert.deepEqual([...new Set(combined.items.map(item => item.category))], ['report','metric','tag']);
assert.equal(combined.total, ['report','metric','tag'].reduce((sum, category) => sum + searchCatalog(reports, category, '').total, 0));
assert.equal(queryReports(reports, {q:'电商',category:'all',filters:emptyFilters(),page:1,pageSize:100}).total, reports.filter(r=>r.module==='电商').length);
assert(query('', {...emptyFilters(), permission:['granted']}).items.every(r=>r.permission==='granted'));
assert.equal(searchCatalog(reports.filter(r=>r.module==='临床经营'), 'tag', '财务').total, 0);
assert(queryReports(reports, {q:'供应链',category:'tag',filters:emptyFilters(),page:1,pageSize:100}).items.every(r=>r.module==='供应链'));
const { request, loadWorkbench, openPlatformEntry } = require('../src/lib/portal-api.ts');
const calls = [];
global.window = { location: {origin:'https://portal.example'}, top: { location:{href:'https://portal.example'}, FS:{tabPane:{addItem:item => calls.push(item)}}, BI:{Services:{getService:() => ({openCustomTab:(...args) => calls.push(args)})}} } };
openPlatformEntry(reports[1]);
assert(calls[0].src.endsWith('/v10/entry/access/entry-2'));
openPlatformEntry(reports.find(r => r.type === 'bi'));
assert.equal(calls[1][2], 'bi.subject.publink');
assert.equal(calls[1][3].subjectEntryType, 2);
openPlatformEntry(reports[1], {entryAccessUrl:'/WebReport/ReportServer/custom/{entryId}',biServiceName:'customer.tabs',biTabType:'customer.bi'});
assert.equal(calls[2].src,'https://portal.example/WebReport/ReportServer/custom/entry-2');
openPlatformEntry(reports.find(r => r.type === 'bi'), {entryAccessUrl:'/custom/{entryId}',biServiceName:'customer.tabs',biTabType:'customer.bi'});
assert.equal(calls[3][2],'customer.bi');
Object.defineProperty(window.top, 'location', {get:() => {throw new Error('cross origin');}});
assert.throws(() => openPlatformEntry(reports[1]), /跨域/);
(async () => {
  global.fetch = async (_, init) => { assert.equal(init.credentials,'include'); return {ok:false,status:401,json:async()=>({})}; };
  await assert.rejects(request('/bootstrap'), /登录已过期/);
  global.fetch = async () => ({ok:false,status:401,json:async()=>({error:{code:'INVALID_IDENTITY',message:'无法匹配当前登录账号'}})});
  await assert.rejects(request('/bootstrap'), /无法匹配当前登录账号/);
  global.fetch = async () => ({ok:false,status:503,json:async()=>{throw new Error('html');}});
  await assert.rejects(request('/reports'), /服务暂时不可用/);
  global.fetch = async () => ({ok:true,status:200,json:async()=>({success:true,data:{items:[]}})});
  assert.deepEqual(await request('/reports'),{items:[]});
  let workbenchRequests=0;
  const snapshot={recent:[{id:'recent-1'}],frequent:[{id:'frequent-1'}],favorites:[{id:'favorite-1'}]};
  global.fetch = async path => {
    workbenchRequests++;assert.equal(path,'/portal/api/portal/v1/workbench/snapshot');
    return {ok:true,status:200,json:async()=>({success:true,data:snapshot})};
  };
  const workbench = await loadWorkbench('/workbench');
  assert.deepEqual(workbench,snapshot);assert.equal(workbenchRequests,1);
  console.log('Portal checks passed: queries, facets, tree, favorites, dates, links, HTTP errors, platform bridge.');
})().catch(error => {console.error(error); process.exitCode = 1;});
