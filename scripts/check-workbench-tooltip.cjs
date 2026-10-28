// Real Railway data and iframe layout: hover/focus preview must not refetch the workbench.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const base = process.env.PORTAL_URL || 'https://portal-production-c6e5.up.railway.app';
  const { accessKey } = JSON.parse(await fs.readFile('artifacts/qa/railway-secrets.json', 'utf8'));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width:1920, height:1080 } });
  await context.addInitScript(() => localStorage.setItem('ynby.portal.guide.v1', 'done'));
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors = [], reads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/portal/v1/workbench?')) reads.push(request.url()); });
  try {
    await page.goto(base + '/poc/');
    await page.locator('#key').fill(accessKey); await page.locator('#login').click();
    const frame = await (await page.locator('#portal').elementHandle()).contentFrame();
    await frame.locator('.workbench-card').first().waitFor();
    const data = {};
    for (const tab of ['recent','frequent','favorites']) {
      const response = await context.request.get(`${base}/api/portal/v1/workbench?tab=${tab}&pageSize=100`);
      assert.equal(response.status(), 200); data[tab] = (await response.json()).data.items;
    }
    const loaded = reads.length;
    for (const [tab, label] of [['recent','最近打开'],['frequent','我常用的'],['favorites','我收藏的']]) {
      await frame.getByRole('button', { name:label, exact:true }).click();
      const report = data[tab][0]; assert(report, `${tab} needs an existing report for this check`);
      const card = frame.locator('.workbench-card').first();
      await card.getByRole('heading', { name:report.name, exact:true }).waitFor();
      const before = await card.boundingBox(); await card.hover();
      const tip = frame.getByRole('tooltip'); await tip.waitFor(); await tip.hover();
      assert.equal(await tip.locator('strong').innerText(), report.name);
      assert.equal(await tip.locator('p').innerText(), report.description || '暂未维护看板介绍');
      assert.equal(await tip.locator('[aria-label="所属领域"]').innerText(), report.module || '暂未维护所属领域');
      assert((await tip.innerText()).includes('更新于 ' + (report.updatedOn || '暂未维护')));
      assert.deepEqual(await card.boundingBox(), before, 'Tooltip must not move the card');
      assert.equal(await tip.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(27, 44, 56)');
      await page.screenshot({ path:`artifacts/qa/workbench-tooltip-${tab}.png` });
      await page.keyboard.press('Escape'); await tip.waitFor({ state:'hidden' });
      const button = card.locator('.card-main'); await button.focus(); await tip.waitFor();
      assert.equal(await button.getAttribute('aria-describedby'), await tip.getAttribute('id'));
      await page.keyboard.press('Escape'); await tip.waitFor({ state:'hidden' });
      await button.evaluate(el => el.blur());
    }
    await frame.getByRole('button', { name:'最近打开', exact:true }).click();
    for (const [width, height, mode] of [[1280,720,'双向自适应'],[1440,900,'宽度自适应'],[2560,1440,'当前布局']]) {
      await page.setViewportSize({ width, height });
      await frame.getByRole('button', { name:mode, exact:true }).click();
      const card = frame.locator('.workbench-card').nth(3); await card.hover();
      const tip = frame.getByRole('tooltip'); await tip.waitFor(); await tip.hover();
      const geometry = await frame.locator('.workbench-tooltip').evaluate(el => {
        const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, right:r.right, bottom:r.bottom, vw:innerWidth, vh:innerHeight, inCanvas:!!el.closest('.portal-canvas') };
      });
      assert.equal(geometry.inCanvas, false, 'Popup stays outside the scaled/clipped canvas');
      assert(Math.abs(geometry.width - 440) < 1, 'Readable tooltip width stays constant across modes');
      assert(geometry.x >= 0 && geometry.y >= 0 && geometry.right <= geometry.vw + 1 && geometry.bottom <= geometry.vh + 1, JSON.stringify(geometry));
      await page.screenshot({ path:`artifacts/qa/workbench-tooltip-${width}.png` });
      await frame.locator('.brand-copy').hover(); await tip.waitFor({ state:'hidden' });
    }
    await page.setViewportSize({ width:1440, height:900 });
    await frame.getByRole('button', { name:'双向自适应', exact:true }).click();
    await frame.getByRole('button', { name:'我常用的', exact:true }).click();
    await frame.locator('.workbench-card').first().hover(); await frame.getByRole('tooltip').waitFor();
    await frame.getByRole('region', { name:'工作台报表列表' }).evaluate(el => { el.scrollTop = 80; });
    await frame.getByRole('tooltip').waitFor({ state:'hidden' });
    assert.equal(reads.length, loaded, 'Hover, focus and tab changes reuse cached report data');
    await frame.getByRole('button', { name:'最近打开', exact:true }).click();
    await frame.locator('.workbench-card').first().locator('.card-main').click();
    await page.frameLocator('#report').getByRole('heading', { name:data.recent[0].name, exact:true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: live metadata, three tabs, hover retention, keyboard/Escape, no refetch/layout shift, scroll dismissal, scaled iframe boundaries and platform opening.');
  } finally {
    await context.request.post(base + '/poc/logout', { headers:{ Origin:base }, data:{} }).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
