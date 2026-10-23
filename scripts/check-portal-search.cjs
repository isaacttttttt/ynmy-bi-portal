// Cloud integration check: real search/history API, browser interactions and embedded layout.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const base = process.env.PORTAL_URL || 'https://portal-production-c6e5.up.railway.app';
  const accessKey = process.env.POC_ACCESS_KEY || JSON.parse(await fs.readFile('artifacts/qa/railway-secrets.json','utf8')).accessKey;
  const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
  const context = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  async function api(path, method='GET', data) {
    const response=await context.request.fetch(base+path,{method,headers:{Origin:base},...(data?{data}:{})});
    assert.equal(response.status(),200,path); return (await response.json()).data;
  }
  await api('/poc/login','POST',{user:'admin',accessKey});
  const snapshots={};for(const category of ['report','tag','metric']) snapshots[category]=await api('/api/portal/v1/search-history?category='+category);
  const writes=[];page.on('request',r=>{if(r.method()==='PUT' && r.url().includes('/search-history'))writes.push(r.postDataJSON());});
  const search=page.getByRole('combobox',{name:'搜索报表'});
  try {
    await page.goto(base);await page.locator('.workbench-card').first().waitFor();
    await page.getByText('从搜索开始',{exact:true}).waitFor();
    await page.getByRole('button',{name:'下一步',exact:true}).click();
    await page.getByText('切换你的工作台',{exact:true}).waitFor();
    await page.getByRole('button',{name:'跳过引导'}).click();
    await page.reload();await page.locator('.workbench-card').first().waitFor();assert.equal(await page.locator('.ant-tour').count(),0);
    await page.getByRole('button',{name:'使用引导'}).click();await page.getByText('从搜索开始',{exact:true}).waitFor();
    await page.keyboard.press('Escape');await page.locator('.ant-tour').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'双向自适应',exact:true}).click();
    await page.getByRole('button',{name:'收起显示模式'}).click();assert.equal(await page.locator('.display-mode-switch').isVisible(),false);
    await page.reload();await page.locator('.workbench-card').first().waitFor();assert.equal(await page.locator('.display-mode-switch').isVisible(),false);
    await page.getByRole('button',{name:'展开显示模式'}).click();
    for(const [width,height] of [[1280,720],[1920,900],[1440,1000]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>{const r=document.querySelector('.portal-frame').getBoundingClientRect();return Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1;});
      await search.click();await page.getByText('最近打开的报表',{exact:true}).waitFor();await page.locator('.search-result-row').first().waitFor();
      const panel=await page.locator('.search-dropdown').boundingBox(), anchor=await page.locator('.portal-search').boundingBox();
      assert(Math.abs(panel.x-anchor.x)<1 && Math.abs(panel.y-anchor.y-anchor.height-10)<1);
      assert(panel.y+panel.height<=height+1);assert.equal(await page.getByText(/猜你想搜/).count(),0);
      await page.screenshot({path:`artifacts/qa/search-dropdown-${width}.png`,fullPage:true});
      await page.keyboard.press('Escape');await page.locator('.search-dropdown').waitFor({state:'hidden'});
    }
    await search.click();const n=writes.length;await search.fill('ROI');
    await page.locator('.search-result-row').first().waitFor();assert.equal(writes.length,n,'Typing does not save history');
    await page.getByRole('tab',{name:'指标',exact:true}).click();
    await page.locator('.search-result-row').filter({hasText:'ROI'}).waitFor();
    await search.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    await page.waitForURL(/category=metric/);await page.locator('.dictionary-card').first().waitFor();assert.equal(await page.locator('.dictionary-card').count(),1);
    await search.click();await page.locator('.search-history-chips button').filter({hasText:'ROI'}).waitFor();
    await page.reload();await page.locator('.dictionary-card').first().waitFor();await search.click();await page.locator('.search-history-chips button').filter({hasText:'ROI'}).waitFor();
    await page.getByRole('button',{name:'清空',exact:true}).click();await page.getByText('暂无搜索记录',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'标签',exact:true}).click();await search.fill('供应链');
    await page.locator('.search-result-row').filter({hasText:'供应链'}).click();await page.waitForURL(/category=tag/);
    await page.getByRole('heading',{name:'库存周转分析',exact:true}).waitFor();assert.equal(await page.locator('.dictionary-card').count(),3);
    await page.getByRole('link',{name:'返回首页',exact:true}).click();await page.locator('.workbench-card').first().waitFor();await search.click();
    await page.locator('.search-result-row').first().waitFor();await page.getByRole('tab',{name:'报表',exact:true}).focus();await page.keyboard.press('Escape');
    await page.locator('.search-dropdown').waitFor({state:'hidden'});assert.equal(await search.getAttribute('aria-expanded'),'false');
    await search.click();await page.locator('.brand-copy').click();await page.locator('.search-dropdown').waitFor({state:'hidden'});
    // Actual platform parent bridge receives the selected recent report.
    await page.goto(base+'/poc/');await page.locator('#key').fill(accessKey);await page.locator('#login').click();
    const embedded=page.frameLocator('#portal');
    await embedded.locator('.workbench-card').first().waitFor();await embedded.getByRole('combobox',{name:'搜索报表'}).click();
    const expected=await embedded.locator('.search-result-copy strong').first().innerText();
    await embedded.locator('.search-result-row').first().click();
    await page.frameLocator('#report').getByRole('heading',{name:expected,exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: coach marks, mode collapse/persistence, independent full-viewport scaling, dropdown alignment, categories, keyboard, history save/clear/reload and platform preview.');
  } finally {
    for(const category of ['report','tag','metric']) {
      await api('/api/portal/v1/search-history?category='+category,'DELETE');
      for(const item of snapshots[category].items.toReversed())await api('/api/portal/v1/search-history','PUT',{category,query:item.query});
    }
    await api('/poc/logout','POST',{});await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
