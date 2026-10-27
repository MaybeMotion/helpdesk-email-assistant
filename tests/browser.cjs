const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer(async (req, res) => {
    const file = path.resolve(root, '.' + req.url.split('?')[0]);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(await fs.readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 380, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.chrome = {
        storage: { local: {
          get: async () => JSON.parse(localStorage.getItem('mockChromeStorage') || '{}'),
          set: async data => localStorage.setItem('mockChromeStorage', JSON.stringify(data))
        } },
        permissions: { contains: async () => true, request: async () => true, remove: async () => true }
      };
      window.confirm = () => true;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copied = text; } } });
    });
    const url = `http://127.0.0.1:${server.address().port}/sidepanel.html`;
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('body').disabled);
    let requests = 0;
    page.on('request', request => { if (request.url().includes(':11434')) requests++; });
    await page.locator('#body').fill('hey, please reply ASAP.');
    await page.locator('#subject').fill('Update');
    await page.locator('#signature').fill('Regards,\nSupport');
    await page.locator('#improve').click();
    await page.locator('#review').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#body').inputValue(), 'hey, please reply ASAP.');
    assert.equal(await page.locator('#suggestion').inputValue(), 'Hello, please reply as soon as possible.');
    await page.locator('#apply').click();
    await page.locator('#copy').click();
    assert.equal(await page.evaluate(() => window.copied), 'Subject: Update\n\nHello, please reply as soon as possible.\n\nRegards,\nSupport');
    await page.locator('#theme').click();
    const dark = await page.locator('body').evaluate(el => el.classList.contains('dark'));
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Saved locally');
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('body').disabled);
    assert.equal(await page.locator('#body').inputValue(), 'Hello, please reply as soon as possible.');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dark')), dark);
    assert.equal(requests, 0, 'offline mode must make no Ollama requests');
    await page.locator('#insert').click();
    assert.match(await page.locator('#body').inputValue(), /Thank you for contacting IT support/);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#body').inputValue(), '');
    assert.equal(await page.locator('#signature').inputValue(), 'Regards,\nSupport');
    await page.locator('summary').click();
    await page.locator('#ollama').check();
    await page.locator('#body').fill('Please investigate this error.');
    await page.route('http://localhost:11434/api/chat', async route => {
      const data = route.request().postDataJSON();
      assert.equal(data.messages[1].content, 'Please investigate this error.');
      assert.ok(!JSON.stringify(data).includes('Regards,'));
      await route.fulfill({ json: { message: { content: 'Could you please investigate this error?' } } });
    });
    await page.locator('#improve').click();
    await page.locator('#review').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#source').textContent(), 'Local Ollama');
    assert.equal(await page.locator('#body').inputValue(), 'Please investigate this error.');
    await page.locator('#dismiss').click();
    await page.unroute('http://localhost:11434/api/chat');
    await page.route('http://localhost:11434/api/chat', route => route.fulfill({ status: 404, body: '{}' }));
    await page.locator('#improve').click();
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('404'));
    assert.equal(await page.locator('#body').inputValue(), 'Please investigate this error.');
    await page.locator('#ollama').uncheck();
    await page.setViewportSize({ width: 280, height: 850 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'narrow panel must not overflow');
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: offline rules, review/apply, copying, persistence, theme, templates, clearing, mocked Ollama success/error, narrow layout.');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
