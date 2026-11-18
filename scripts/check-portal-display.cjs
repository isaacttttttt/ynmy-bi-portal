const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(() => localStorage.setItem('ynby.portal.guide.v1', 'done'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  const base = process.env.PORTAL_URL || 'http://localhost:3100';
  try {
    await page.route(base + '/display-test-host', route => route.fulfill({ contentType: 'text/html', body: `<iframe name="portal" src="${base}/portal/" style="width:100%;height:100vh;border:0;display:block"></iframe><style>body{margin:0}</style>` }));
    await page.goto(base + '/display-test-host');
    const frame = page.frame({ name: 'portal' });
    await frame.locator('.workbench-card').first().waitFor();
    assert.equal(await frame.locator('.portal-viewport').getAttribute('data-display-mode'), 'fit');
    // Distinguish the top window from iframe storage even though both share an origin.
    await frame.evaluate(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Use top window storage'); } }));
    await frame.getByRole('button', { name: '宽度自适应', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('ynby.portal.display-mode') === 'width');
    await frame.goto(base + '/portal/');
    await frame.locator('.workbench-card').first().waitFor();
    assert.equal(await frame.locator('.portal-viewport').getAttribute('data-display-mode'), 'width');
    await frame.getByRole('button', { name: '选择事业群' }).click();
    const menu = frame.locator('.topic-dropdown').filter({ visible: true });
    await menu.waitFor();
    assert(await menu.evaluate(el => el.parentElement === document.body && +getComputedStyle(el).zIndex >= 4000));
    assert.equal(await menu.locator('.ant-dropdown-menu').evaluate(el => getComputedStyle(el).borderRadius), '8px');
    assert.equal(await menu.getByRole('menuitem').nth(1).evaluate(el => getComputedStyle(el).marginTop), '3px');
    await menu.getByRole('menuitem', { name: '临床事业群' }).click();
    await frame.locator('.topic-card').filter({ hasText: '终端数据面板' }).waitFor();
    await frame.getByRole('button', { name: '选择事业群' }).click();
    await menu.getByRole('menuitem', { name: '健康品事业群' }).click();
    await frame.getByRole('button', { name: /销售专题分析/ }).click();
    await frame.getByRole('button', { name: '切换销售专题分析同级目录' }).click();
    await menu.getByRole('menuitem', { name: '财务专题分析' }).click();
    assert.equal(await frame.locator('.breadcrumbs [aria-current="page"]').textContent(), '财务专题分析');
    await frame.getByRole('link', { name: '报表字典', exact: true }).click();
    await frame.locator('.dictionary-card .card-main').first().waitFor();
    for (const [width, height] of [[1280,720], [1440,900], [1920,1080], [2223,1347], [2560,1440], [2560,720]]) {
      await page.setViewportSize({ width, height });
      for (const label of ['当前布局', '宽度自适应', '双向自适应']) {
        await frame.getByRole('button', { name: label, exact: true }).click();
        await frame.waitForFunction(() => !document.getAnimations().some(a => a.effect?.getTiming().duration === 280 && a.playState === 'running'));
        const geometry = await frame.locator('.dictionary-results').evaluate(el => {
          const cards = [...el.querySelectorAll('.dictionary-card')];
          const box = el.getBoundingClientRect();
          return { overflow: el.scrollHeight - el.clientHeight, heights: cards.map(c => c.getBoundingClientRect().height), rows: [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)))].length, contained: cards.every(c => c.getBoundingClientRect().bottom <= box.bottom + 1), actions: cards.every(c => c.querySelector('.dictionary-actions').getBoundingClientRect().bottom <= c.getBoundingClientRect().bottom), bottoms: ['.filters','.dictionary-panel'].map(s => document.querySelector(s).getBoundingClientRect().bottom) };
        });
        assert(geometry.overflow <= 1, `${width} ${label}: no inner overflow`);
        assert.equal(geometry.rows, 2, `${width} ${label}: two rows`);
        assert(Math.max(...geometry.heights) - Math.min(...geometry.heights) < 1);
        assert(geometry.contained && geometry.actions, `${width} ${label}: cards and actions fit`);
        assert(Math.abs(geometry.bottoms[0] - geometry.bottoms[1]) < 1);
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await frame.evaluate(() => window.scrollTo(0, 0));
    await fs.mkdir('artifacts/qa', { recursive: true });
    await page.screenshot({ path: 'artifacts/qa/dictionary-two-rows.png' });
    await frame.getByRole('button', { name: '下一页', exact: true }).click();
    await frame.locator('.dictionary-results [data-slot="skeleton"]').first().waitFor();
    await frame.locator('.dictionary-card .card-main').first().waitFor();
    assert.equal(await frame.locator('.loading-spin').count(), 0);
    await frame.getByRole('button', { name: '列表视图' }).click();
    assert(await frame.locator('.dictionary-results').evaluate(el => el.scrollHeight <= el.clientHeight + 1));
    await frame.getByRole('button', { name: '查看详情', exact: true }).first().click();
    await frame.locator('.report-drawer').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: default fit, top-window storage, reload, rounded body-level directory menus, breadcrumb navigation, 18 desktop layout cases, pagination skeleton and details.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
