const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/16225/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');

(async () => {
  const base = 'https://portal-production-c6e5.up.railway.app';
  const { accessKey } = JSON.parse(await fs.readFile('artifacts/qa/railway-secrets.json', 'utf8'));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const requested = new Set();
  try {
    const login = await context.request.post(base + '/poc/login', { headers: { Origin: base }, data: { user: 'admin', accessKey } });
    assert.equal(login.status(), 200);
    await context.addInitScript(() => localStorage.setItem('ynby.portal.guide.v1', 'done'));
    if (process.env.ICON_TEST_LOCAL) await context.route(base + '/**', async route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      if (pathname.startsWith('/api/') || pathname.startsWith('/poc/')) return route.fallback();
      const file = path.join(process.cwd(), 'out', pathname === '/' ? 'index.html' : pathname);
      const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' }[path.extname(file)];
      await route.fulfill({ body: await fs.readFile(file), contentType });
    });
    await context.route('**/api/portal/v1/workbench/snapshot', async route => {
      const response = await route.fetch(), body = await response.json();
      assert(body.data.recent.length > 8);
      body.data.recent[0].iconUrl = 'https://icon-test.invalid/slow.png';
      body.data.recent[1].iconUrl = 'https://icon-test.invalid/broken.png';
      body.data.recent.at(-1).iconUrl = 'https://icon-test.invalid/offscreen.png';
      await route.fulfill({ response, json: body });
    });
    await context.route('https://icon-test.invalid/**', async route => {
      const name = new URL(route.request().url()).pathname;
      requested.add(name);
      if (name === '/slow.png') await gate;
      if (name === '/broken.png') return route.fulfill({ status: 404, body: '' });
      await route.fulfill({ contentType: 'image/png', body: await fs.readFile('public/assets/报表.png') });
    });
    const page = await context.newPage();
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const first = page.locator('.workbench-card .entry-icon').first();
    await first.waitFor();
    await page.waitForFunction(() => document.querySelector('.workbench-card .entry-icon img')?.complete);
    assert.match(await first.locator('img').getAttribute('src'), /^\/assets\//);
    const bounds = await first.boundingBox();
    assert(!requested.has('/offscreen.png'), 'Clipped cards must not request remote icons');
    release();
    await page.waitForFunction(() => document.querySelector('.workbench-card .entry-icon img')?.getAttribute('src') === 'https://icon-test.invalid/slow.png');
    assert.deepEqual(await first.boundingBox(), bounds, 'Icon replacement must not shift layout');
    assert.match(await page.locator('.workbench-card .entry-icon').nth(1).locator('img').getAttribute('src'), /^\/assets\//);
    await page.getByRole('region', { name: '工作台报表列表', exact: true }).evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForFunction(() => [...document.querySelectorAll('.workbench-card .entry-icon img')].some(img => img.getAttribute('src') === 'https://icon-test.invalid/offscreen.png'));
    assert(requested.has('/broken.png')); assert(requested.has('/offscreen.png'));
    console.log('PASS: local first, decoded remote replacement, failed URL fallback, clipped icons deferred, stable dimensions.');
  } finally {
    release();
    await context.request.post(base + '/poc/logout', { headers: { Origin: base }, data: {} });
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
