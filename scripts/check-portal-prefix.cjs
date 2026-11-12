// Run after an API-mode build. Exercise exported Next pages served by the real backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
const { mockRequest } = require('../src/lib/portal-mock.ts');

(async () => {
  process.env.PUBLIC_ORIGIN = 'http://localhost';
  process.env.FINE_ROOT_ID = 'topics';
  delete process.env.POC_PLATFORM_URL;
  const { buildApp } = await import('../backend/src/app.js');
  // No database or BI instance is needed for a routing test; business endpoints use existing fixtures.
  const app = await buildApp({ platform: { context: () => { throw new Error('API interception missing'); } },
    db: { query: async sql => { assert.equal(sql, 'SELECT 1'); return { rows: [] }; }, end: async () => {} } });
  let browser;
  try {
    const origin = await app.listen({ host: '127.0.0.1', port: 0 });
    browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await context.addInitScript(() => localStorage.setItem('ynby.portal.guide.v1', 'done'));
    const requests = [], failures = [], errors = [];
    let releaseIcon;
    const iconGate = new Promise(resolve => { releaseIcon = resolve; });
    await context.route('https://icons.test/ok.png', async route => {
      await iconGate;
      await route.fulfill({ contentType: 'image/png', body: fs.readFileSync('public/assets/company_title.png') });
    });
    await context.route('https://icons.test/fail.png', route => route.abort());
    await context.route('**/portal/api/portal/v1/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const endpoint = url.pathname.slice('/portal/api/portal/v1'.length);
      let data = endpoint === '/workbench/snapshot'
        ? Object.fromEntries(['recent', 'frequent', 'favorites'].map(tab => [tab, mockRequest(`/workbench?tab=${tab}&pageSize=100`).items]))
        : mockRequest(endpoint + url.search, req.postDataJSON() ?? undefined, req.method());
      if (endpoint === '/bootstrap') data = { ...data, quickEntries: [
        { id:'icon-ok',name:'Icon OK',description:'',url:'https://example.test',iconUrl:'https://icons.test/ok.png' },
        { id:'icon-fail',name:'Icon fail',description:'',url:'https://example.test',iconUrl:'https://icons.test/fail.png' },
      ] };
      if (endpoint === '/reports') data = { ...data, items: data.items.map((r, i) => ({ ...r, permission: i === 0 ? 'denied' : 'granted' })) };
      await route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    page.on('request', req => { if (req.url().startsWith(origin)) requests.push(new URL(req.url()).pathname); });
    page.on('response', res => { if (res.status() >= 400) failures.push([res.status(), res.url()]); });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(origin + '/portal');
    await page.locator('.workbench-card').first().waitFor();
    const icon = page.locator('.quick-icon').first();
    assert((await icon.evaluate(el => getComputedStyle(el).backgroundImage)).includes('/portal/assets/'));
    releaseIcon();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.quick-icon img')).opacity === '1');
    assert.equal(await icon.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
    assert((await page.locator('.quick-icon').nth(1).evaluate(el => getComputedStyle(el).backgroundImage)).includes('/portal/assets/'));
    assert.equal(new URL(page.url()).pathname, '/portal/');
    await page.getByRole('combobox', { name: '搜索报表' }).fill('库存');
    await page.getByRole('combobox', { name: '搜索报表' }).press('Enter');
    await page.waitForURL(url => url.pathname === '/portal/report-dictionary/' && url.searchParams.get('q') === '库存');
    await page.locator('.dictionary-card').first().waitFor();
    await page.locator('.home-link').click();
    await page.locator('.workbench-card').first().waitFor();
    await page.locator('.dictionary-link').click();
    await page.locator('.dictionary-card').first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/portal/report-dictionary/');
    const denied = page.locator('.dictionary-card').first();
    assert.equal(await denied.locator('.permission-badge').innerText(), '无权限');
    assert.equal(await denied.locator('.permission-badge').evaluate(el => getComputedStyle(el).borderRadius), '8px');
    assert(await denied.locator('.open-report').isDisabled());
    assert(await denied.locator('.favorite').isDisabled());
    assert.equal(await page.locator('.dictionary-card').nth(1).locator('.permission-badge').innerText(), '有权限');
    await denied.locator('.permission-badge').hover();
    await page.getByRole('tooltip').waitFor();
    await page.screenshot({ path: 'outputs/r7-dictionary-permission.png' });
    await denied.locator('.card-main').click();
    await page.locator('.report-drawer .detail-footer').waitFor();
    assert(await page.locator('.report-drawer .primary-button').isDisabled());
    assert(await page.locator('.report-drawer .favorite').isDisabled());
    await page.locator('.report-drawer .secondary-button').click();
    await page.reload();
    await page.locator('.dictionary-card').first().waitFor();
    await page.locator('.home-link').click();
    await page.locator('.workbench-card').first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/portal/');
    assert(requests.some(path => path.startsWith('/portal/api/portal/v1/')), 'Use an API-mode frontend build');
    assert(requests.some(path => path.startsWith('/portal/_next/')));
    assert(requests.some(path => path.startsWith('/portal/assets/')));
    assert(requests.every(path => path === '/portal' || path.startsWith('/portal/')), JSON.stringify(requests));
    assert.deepEqual(failures, []);
    assert.deepEqual(errors, []);
    console.log('PASS: /portal redirect, navigation, deep-link reload, API and all local assets stay under /portal/.');
  } finally { if (browser) await browser.close(); await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
