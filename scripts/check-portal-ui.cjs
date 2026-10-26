// PLAYWRIGHT_MODULE may point to the host's bundled Playwright; no app dependency is required.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const mockHttp = process.env.PORTAL_MOCK_HTTP === '1';
const livePoc = process.env.PORTAL_LIVE_POC === '1';
let mockRequest;
if (mockHttp) {
  const ts = require('typescript');
  require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  ({ mockRequest } = require('../src/lib/portal-mock.ts'));
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const context = await browser.newContext({ viewport: { width:1920, height:1080 } });
  await context.addInitScript(() => { try { localStorage.setItem('ynby.portal.guide.v1', 'done'); } catch {} });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.PORTAL_URL || 'http://localhost:3000';
  const reads = [];
  let accessKey, initialFavorite;
  const liveWrite = async (url, data) => {
    const response = await context.request.fetch(base + url, {method:url.startsWith('/api/')?'PUT':'POST',headers:{Origin:base},data});
    assert.equal(response.status(),200,url); return response;
  };
  if (livePoc) {
    assert(!mockHttp,'Live verification must not intercept HTTP');
    accessKey = process.env.POC_ACCESS_KEY || JSON.parse(await fs.readFile('artifacts/qa/railway-secrets.json','utf8')).accessKey;
    await liveWrite('/poc/login',{user:'admin',accessKey});
    const bootstrap=await (await context.request.get(base+'/api/portal/v1/bootstrap')).json();
    initialFavorite=bootstrap.data.favoriteIds.includes('entry-1');
    await liveWrite('/api/portal/v1/favorites/entry-1',{favorite:false});
    page.on('request',request=>{const u=new URL(request.url());if(request.method()==='GET'&&u.pathname.startsWith('/api/portal/v1/'))reads.push(u.pathname.replace('/api/portal/v1','')+u.search);});
  }
  let refreshMode = 'initial';
  if (mockHttp) await page.context().route('**/api/portal/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const endpoint = url.pathname.replace('/api/portal/v1', '');
    if (request.method() === 'GET') reads.push(endpoint + url.search);
    if ((refreshMode === 'failure' && endpoint === '/workbench') || refreshMode === 'expired') {
      await route.fulfill({ status:refreshMode === 'expired' ? 401 : 503, json:{success:false} }); return;
    }
    const data = structuredClone(mockRequest(endpoint + url.search, request.method() === 'PUT' ? request.postDataJSON() : undefined, request.method()));
    if (refreshMode === 'updated' && endpoint === '/workbench') data.items[0].name = '后台更新后的报表';
    await route.fulfill({json:{success:true,data}});
  });
  const output = path.resolve('artifacts/qa'); await fs.mkdir(output, {recursive:true});
  try {
    for (const width of [1280,1440,1920,2560]) {
      await page.setViewportSize({width,height:Math.round(width * 9 / 16)});
      for (const [route, target, name] of [['/','.workbench-card','home'],['/report-dictionary/','.dictionary-card','dictionary']]) {
        await page.goto(base + route); await page.locator(target).first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow at ${width}`);
        const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(i => i.complete && !i.naturalWidth).map(i=>i.src));
        assert.deepEqual(broken, []);
        if (name === 'home') {
          assert.equal(Math.round((await page.locator('.workbench').boundingBox()).height), width >= 2200 ? 555 : width < 1600 ? 471 : 460);
          assert.equal(Math.round((await page.locator('.thematic').boundingBox()).height), width >= 2200 ? 396 : width < 1600 ? 351 : 320);
          assert((await page.locator('.portal-search').boundingBox()).width >= 680);
          const row = page.locator('.notice-row').first();
          const title = await row.getAttribute('aria-label');
          assert.equal(await row.locator('h3').innerText(), Array.from(title).slice(0,12).join('') + '......');
          for (const selector of ['time','.notice-pin']) {
            const item = await row.locator(selector).boundingBox(), box = await row.boundingBox();
            assert(Math.abs(item.y + item.height / 2 - box.y - box.height / 2) <= 1, `Notice ${selector} not centered`);
          }
          assert.equal(await row.evaluate(el => getComputedStyle(el).padding), '4px');
        } else {
          const left = await page.locator('.filters').boundingBox(), right = await page.locator('.dictionary-panel').boundingBox();
          assert(Math.abs(left.y + left.height - right.y - right.height) <= 1, `Dictionary bottom mismatch at ${width}`);
        }
        await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.goto(base); await page.locator('.workbench-card').first().waitFor();
    await page.getByRole('button',{name:'我常用的',exact:true}).click();
    await page.getByText('近30天访问',{exact:true}).first().waitFor();
    const scroll = page.getByRole('region',{name:'工作台报表列表'});
    assert(await scroll.evaluate(el => el.scrollHeight > el.clientHeight));
    await page.mouse.move(0,0);
    assert.equal(await scroll.evaluate(el => getComputedStyle(el).getPropertyValue('--scroll-thumb').trim()),'transparent');
    await scroll.hover();
    assert.equal(await scroll.evaluate(el => getComputedStyle(el).getPropertyValue('--scroll-thumb').trim()),'#1677ff');
    await page.mouse.move(0,0);
    await scroll.evaluate(el => {el.scrollTop = 50;});
    await page.waitForFunction(() => document.querySelector('.panel-scroll').classList.contains('is-scrolling'));
    await page.waitForFunction(() => !document.querySelector('.panel-scroll').classList.contains('is-scrolling'));
    await page.getByRole('button',{name:'最近打开',exact:true}).click();
    const readsBeforeFavorite = reads.filter(p=>p.startsWith('/workbench?')).length;
    const favorite = page.getByRole('button',{name:'收藏集团经营分析总览驾驶舱',exact:true});
    await favorite.focus(); await favorite.click();
    await page.getByRole('button',{name:'我收藏的',exact:true}).click();
    await page.locator('.workbench-card').filter({hasText:'集团经营分析总览驾驶舱'}).waitFor();
    await page.getByRole('button',{name:'取消收藏集团经营分析总览驾驶舱',exact:true}).click();
    await page.locator('.workbench-card').filter({hasText:'集团经营分析总览驾驶舱'}).waitFor({state:'hidden'});
    assert.equal(reads.filter(p=>p.startsWith('/workbench?')).length, readsBeforeFavorite,'Favorite writes must update cache without refetching');
    await page.getByRole('button',{name:/销售专题分析/}).click();
    await page.getByRole('button',{name:/区域销售.*个对象/}).click();
    await page.locator('.topic-card').filter({hasText:'区域销售排名报表'}).waitFor();
    assert.equal(await page.locator('.breadcrumbs button').count(),4);
    await page.getByRole('combobox',{name:'选择事业群'}).selectOption('clinical');
    await page.locator('.topic-card').filter({hasText:'终端数据面板'}).waitFor();
    await page.getByRole('button',{name:/云南白药集团数据门户管理办法/}).click();
    await page.getByRole('button',{name:'我知道了',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'全部公告 ›'}).click();
    await page.getByRole('button',{name:/报表字典维护说明/}).waitFor();
    await page.locator('.ant-modal-close').filter({visible:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('combobox',{name:'搜索报表'}).fill('ROI');
    await page.getByRole('button',{name:'搜索',exact:true}).click();
    await page.locator('.dictionary-card').first().waitFor();
    assert.equal(await page.locator('.dictionary-card').count(),1);
    await page.getByRole('button',{name:'清除全部条件'}).click();
    await page.locator('.dictionary-card').nth(5).waitFor();
    await page.getByRole('checkbox',{name:/供应链/}).check();
    await page.getByRole('heading',{name:'库存周转分析',exact:true}).waitFor();
    assert.equal(await page.locator('.dictionary-card').count(),3);
    await page.getByRole('button',{name:'列表视图'}).click();
    await page.locator('.dictionary-list').waitFor();
    await page.getByRole('button',{name:'查看详情',exact:true}).first().click();
    await page.getByRole('heading',{name:'核心指标'}).waitFor();
    await page.locator('.ant-modal-close').filter({visible:true}).focus();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'清除全部条件'}).click();
    await page.getByRole('button',{name:'下一页',exact:true}).click();
    await page.waitForURL(/page=2/); await page.locator('.dictionary-card').first().waitFor();
    await page.getByRole('combobox',{name:'搜索报表'}).fill('不存在的报表');
    await page.getByRole('button',{name:'搜索',exact:true}).click();
    await page.getByText('暂无符合条件的内容',{exact:true}).waitFor();
    await page.getByRole('button',{name:'清空搜索',exact:true}).click();
    await page.locator('.dictionary-card').first().waitFor();
    await page.setViewportSize({width:1024,height:768});
    assert(await page.evaluate(() => document.documentElement.scrollWidth >= 1280));
    // All modes use the same mounted pages; only their outer canvas changes.
    for (const [width,height] of [[1280,720],[1440,900],[1920,900],[2560,1440]]) {
      await page.setViewportSize({width,height});
      for (const route of ['/','/report-dictionary/']) {
        await page.goto(base+route);
        await page.locator(route==='/' ? '.workbench-card' : '.dictionary-card').first().waitFor();
        for (const [mode,label] of [['width','宽度自适应'],['fit','双向自适应']]) {
          await page.getByRole('button',{name:label,exact:true}).click();
          await page.waitForFunction(mode => {
            const frame=document.querySelector('.portal-frame').getBoundingClientRect();
            const canvas=document.querySelector('.portal-canvas');
            const contentHeight=parseFloat(getComputedStyle(canvas).height);
            const ratio=document.documentElement.clientWidth/1920;
            return Math.abs(frame.width-document.documentElement.clientWidth)<1 && Math.abs(frame.height-(mode==='width'?contentHeight*ratio:innerHeight))<1;
          },mode);
          const dimensions=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,canvas:document.querySelector('.portal-canvas').offsetWidth}));
          assert(await page.locator('.portal-canvas').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return Math.abs(m.a-m.d)<.00001}),'Both axes must use the same scale');
          assert.equal(dimensions.canvas,1920);
          assert(dimensions.w<=width,`${mode} horizontal overflow at ${width}`);
          if(mode==='fit') assert(dimensions.h<=height+1,`Fit must show the complete page at ${width}x${height}`);
          if(route==='/' && mode==='width') {
            const scale=await page.locator('.portal-canvas').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).d);
            assert(Math.abs((await page.locator('.workbench').boundingBox()).height-460*scale)<1,'Width mode preserves design panel height');
          }
          await page.screenshot({path:path.join(output,`${route==='/'?'home':'dictionary'}-${mode}-${width}.png`),fullPage:true});
        }
      }
    }
    await page.reload(); await page.locator('.dictionary-card').first().waitFor();
    assert.equal(await page.getByRole('button',{name:'双向自适应',exact:true}).getAttribute('aria-pressed'),'true','Remember the mode on reload');
    await page.getByRole('button',{name:'列表视图'}).click();
    await page.locator('.dictionary-list').waitFor();
    await page.getByRole('button',{name:'查看详情',exact:true}).first().click();
    await page.getByRole('dialog').waitFor();
    await page.waitForFunction(()=>Math.abs(document.querySelector('[role="dialog"]').getBoundingClientRect().width-820)<1);
    await page.locator('.ant-modal-close').filter({visible:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('link',{name:'返回首页',exact:true}).click();
    await page.locator('.workbench-card').first().waitFor();
    assert.equal(await page.getByRole('button',{name:'双向自适应',exact:true}).getAttribute('aria-pressed'),'true','Keep the mode across routes');
    await page.getByRole('button',{name:'我常用的',exact:true}).click();
    await page.getByRole('button',{name:'宽度自适应',exact:true}).click();
    await page.getByRole('button',{name:'当前布局',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'我常用的',exact:true}).getAttribute('aria-pressed'),'true','Mode changes keep workbench state');
    const host = await page.context().newPage();
    host.on('pageerror',e=>errors.push(e.message));
    await host.setViewportSize({width:1920,height:1080});
    await host.addInitScript(()=>{
      Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new DOMException('Storage blocked','SecurityError'); };
    });
    if(livePoc) await host.goto(base+'/poc/');
    await host.setContent(`<iframe name="embedded-portal" src="${base}/" style="width:1280px;height:640px;border:0"></iframe>`);
    const embedded=host.frame({name:'embedded-portal'});
    await embedded.locator('.workbench-card').first().waitFor();
    await embedded.getByRole('button',{name:'双向自适应',exact:true}).click();
    for (const [width,height] of [[1280,640],[1440,800]]) {
      await host.locator('iframe').evaluate((el,{width,height})=>{el.style.width=`${width}px`;el.style.height=`${height}px`;},{width,height});
      await embedded.waitForFunction(()=>{
        const box=document.querySelector('.portal-frame').getBoundingClientRect();
        return box.width>0 && box.right<=innerWidth+1 && box.bottom<=innerHeight+1 && document.documentElement.scrollHeight<=innerHeight+1 && Math.abs(box.width-innerWidth)<1 && Math.abs(box.height-innerHeight)<1;
      });
      assert.equal(await embedded.getByRole('button',{name:'双向自适应',exact:true}).getAttribute('aria-pressed'),'true');
    }
    await host.close();
    if (livePoc) {
      await page.clock.install();
      await page.goto(base); await page.locator('.workbench-card').first().waitFor();
      const countReads=()=>reads.filter(p=>p.startsWith('/workbench?')).length;
      const before=countReads();
      for(const name of ['我收藏的','最近打开','我常用的'])await page.getByRole('button',{name,exact:true}).click();
      assert.equal(countReads(),before,'Live tab switching uses cache');
      await liveWrite('/api/portal/v1/favorites/entry-1',{favorite:true});
      await page.clock.fastForward(600100);
      await page.getByRole('button',{name:'取消收藏集团经营分析总览驾驶舱',exact:true}).waitFor();
      assert.equal(countReads(),before+3,'Live refresh fetches all tabs');
      await liveWrite('/poc/control',{accessKey,action:'fault',user:'admin',fault:'tree-unavailable'});
      const failed=page.waitForResponse(r=>r.url().includes('/workbench?')&&r.status()===502);
      await page.clock.fastForward(600100); await failed;
      assert(await page.locator('.workbench-card').count()>0,'Live upstream failure preserves last view');
      await liveWrite('/poc/control',{accessKey,action:'fault',user:'admin',fault:'none'});
      await liveWrite('/api/portal/v1/favorites/entry-1',{favorite:false});
      await liveWrite('/poc/logout',{});
      await page.clock.fastForward(600100);
      await page.getByText('登录已过期，请返回帆软平台重新登录',{exact:true}).waitFor();
      assert.equal(await page.locator('.workbench-card').count(),0);
      await page.goto(base+'/poc/');
      await page.locator('#key').fill(accessKey); await page.locator('#login').click();
      const portal=page.frameLocator('#portal');
      await portal.locator('.workbench-card .card-main').first().click();
      await page.frameLocator('#report').getByText('这是 Railway 上的帆软模拟预览，不包含真实业务报表。',{exact:true}).waitFor();
      await page.locator('#close').click();
      await portal.getByRole('combobox',{name:'选择事业群'}).selectOption('clinical');
      await portal.getByRole('button',{name:/终端数据面板.*BI 分析/}).click();
      await page.frameLocator('#report').getByRole('heading',{name:'终端数据面板'}).waitFor();
      await page.locator('#close').click();
      await page.locator('#user').selectOption('empty'); await page.locator('#login').click();
      await portal.getByText('暂无符合条件的内容',{exact:true}).first().waitFor();
      assert.equal(await portal.locator('.workbench-card').count(),0);
      console.log('Live Railway: cache, 10-minute refresh, persistent favorite update, upstream failure, session expiry, parent BI/FS preview and empty user passed.');
    }
    if (mockHttp) {
      await page.setViewportSize({width:1920,height:1080});
      await page.clock.install();
      await page.goto(base); await page.locator('.workbench-card').first().waitFor();
      const countReads = () => reads.filter(p => p.startsWith('/workbench?')).length;
      const initialReads = countReads();
      for (const name of ['我收藏的','最近打开','我常用的']) {
        await page.getByRole('button',{name,exact:true}).click();
        assert.equal(await page.locator('.workbench .request-state').count(),0);
        assert.equal(Math.round((await page.locator('.workbench').boundingBox()).height),460);
      }
      assert.equal(countReads(),initialReads,'Tab changes must use cache');
      await page.getByRole('region',{name:'工作台报表列表'}).evaluate(el => {el.scrollTop=80;});
      refreshMode = 'updated';
      await page.clock.fastForward(600100);
      await page.getByRole('heading',{name:'后台更新后的报表',exact:true}).waitFor();
      assert.equal(countReads(),initialReads+3,'Refresh must fetch all three tabs once');
      assert.equal(await page.getByRole('region',{name:'工作台报表列表'}).evaluate(el=>el.scrollTop),80,'Silent refresh keeps scroll position');
      assert.equal(await page.getByRole('button',{name:'我常用的',exact:true}).getAttribute('aria-pressed'),'true');
      refreshMode = 'failure';
      const failed = page.waitForResponse(r=>r.url().includes('/workbench?') && r.status()===503);
      await page.clock.fastForward(600100); await failed;
      assert.equal(await page.getByRole('heading',{name:'后台更新后的报表',exact:true}).count(),1,'Transient failure keeps cached data');
      assert.equal(await page.locator('.workbench .request-state').count(),0);
      refreshMode = 'expired';
      await page.clock.fastForward(600100);
      await page.getByText('登录已过期，请返回帆软平台重新登录',{exact:true}).waitFor();
      assert.equal(await page.locator('.workbench-card').count(),0,'Expired session removes cached UI');
    }
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: desktop widths, three display modes, persistence, unscaled dialogs, fixed panels, scrollbars, notice alignment, dictionary bottoms and main interactions.' + (mockHttp ? ' HTTP cache, 10-minute refresh, transient failure and session expiry passed.' : ''));
  } finally {
    if(livePoc && initialFavorite!==undefined){
      await liveWrite('/poc/login',{user:'admin',accessKey});
      await liveWrite('/poc/control',{accessKey,action:'fault',user:'admin',fault:'none'});
      await liveWrite('/api/portal/v1/favorites/entry-1',{favorite:initialFavorite});
      await liveWrite('/poc/logout',{});
    }
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
