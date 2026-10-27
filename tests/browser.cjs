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
    try {
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'text/html');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 380, height: 850 } });
    const errors = [], remoteRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) remoteRequests.push(request.url()); });
    await page.addInitScript(() => {
      window.chrome = {
        runtime: { id: 'test-extension' },
        storage: { local: {
          get: async () => JSON.parse(localStorage.getItem('mockChromeStorage') || '{}'),
          set: async data => localStorage.setItem('mockChromeStorage', JSON.stringify(data))
        } },
        permissions: {
          contains: async () => true,
          request: async () => !window.denyPermission,
          remove: async () => true
        }
      };
      window.confirm = () => true;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copied = text; } } });
    });
    const url = `http://127.0.0.1:${server.address().port}/sidepanel.html`;
    await page.goto(url);
    const ready = () => page.waitForFunction(() => !document.getElementById('body').disabled);
    await ready();
    assert.equal(await page.locator('#subject').count(), 0);
    assert.equal(await page.locator('#signature').count(), 0);
    assert.equal(await page.getByText('Personal touch', { exact: true }).count(), 0);
    // Native disclosure controls support both mouse and keyboard, and persist locally.
    await page.locator('#quick-start > summary').click();
    await page.locator('#draft > summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#template').isVisible(), false);
    assert.equal(await page.locator('#body').isVisible(), false);
    await page.waitForFunction(() => {
      const sections = JSON.parse(localStorage.getItem('mockChromeStorage') || '{}').assistant?.sections;
      return sections?.['quick-start'] === false && sections?.draft === false;
    });
    await page.reload(); await ready();
    assert.equal(await page.locator('#quick-start').evaluate(el => el.open), false);
    assert.equal(await page.locator('#draft').evaluate(el => el.open), false);
    await page.locator('#draft > summary').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#body').isVisible(), true);
    assert.equal(await page.locator('#template option').count(), 18);
    assert.equal(await page.locator('#template optgroup').count(), 3);
    assert.equal(await page.locator('.logo').evaluate(img => img.complete && img.naturalWidth), 48);
    await page.locator('#improve').click();
    assert.match(await page.locator('#improve-status').textContent(), /Write a message first/);
    await page.locator('#body').fill('hey, please reply ASAP.');
    await page.locator('#improve').click();
    await page.locator('#review').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#body').inputValue(), 'hey, please reply ASAP.');
    assert.equal(await page.locator('#suggestion').inputValue(), 'Hello, please reply as soon as possible.');
    // Rendering is not enough: the old bug left the suggestion outside the viewport.
    await page.waitForFunction(() => {
      const bounds = document.getElementById('review').getBoundingClientRect();
      return bounds.top >= 0 && bounds.top < innerHeight / 2;
    });
    assert.equal(await page.locator('#review-heading').evaluate(el => document.activeElement === el), true);
    await page.locator('#review-heading').click();
    assert.equal(await page.locator('#suggestion').isVisible(), false);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#suggestion').isVisible(), true);
    await page.locator('#apply').click();
    await page.locator('#copy').click();
    assert.equal(await page.evaluate(() => window.copied), 'Hello, please reply as soon as possible.\n\nKind regards,\nLouis');
    await page.locator('#theme').click();
    const dark = await page.locator('body').evaluate(el => el.classList.contains('dark'));
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Saved locally');
    await page.reload(); await ready();
    assert.equal(await page.locator('#body').inputValue(), 'Hello, please reply as soon as possible.');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dark')), dark);
    await page.locator('#body').fill('Please review the update.');
    await page.locator('#improve').click();
    assert.match(await page.locator('#improve-status').textContent(), /no wording changes/);
    assert.equal(await page.locator('#apply').isDisabled(), true);
    assert.match(await page.locator('#changes').textContent(), /No matching offline rules/);
    await page.locator('#suggestion').fill('Please review the latest update.');
    assert.equal(await page.locator('#apply').isDisabled(), false);
    await page.locator('#apply').click();
    assert.equal(await page.locator('#body').inputValue(), 'Please review the latest update.');
    // Existing drafts retain their content while the obsolete subject and custom signature are removed.
    await page.evaluate(() => localStorage.setItem('mockChromeStorage', JSON.stringify({ assistant: { subject: 'Legacy subject', body: 'Saved legacy message', signature: 'Regards,\nSupport' } })));
    await page.reload(); await ready();
    assert.equal(await page.locator('#body').inputValue(), 'Saved legacy message');
    await page.waitForFunction(() => {
      const data = JSON.parse(localStorage.getItem('mockChromeStorage')).assistant;
      return !Object.hasOwn(data, 'subject') && !Object.hasOwn(data, 'signature');
    });
    await page.locator('#copy').click();
    assert.equal(await page.evaluate(() => window.copied), 'Saved legacy message\n\nKind regards,\nLouis');
    // Declining replacement leaves the draft untouched.
    await page.evaluate(() => { window.confirm = () => false; });
    await page.locator('#insert').click();
    assert.equal(await page.locator('#body').inputValue(), 'Saved legacy message');
    await page.evaluate(() => { window.confirm = () => true; });
    await page.locator('#template').selectOption({ label: 'Arrange a meeting' });
    await page.locator('#draft > summary').click();
    assert.equal(await page.locator('#body').isVisible(), false);
    await page.locator('#insert').click();
    assert.equal(await page.locator('#draft').evaluate(el => el.open), true);
    assert.match(await page.locator('#body').inputValue(), /arrange a meeting/);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#body').inputValue(), '');
    await page.evaluate(() => { window.copied = 'unchanged clipboard'; });
    await page.locator('#copy').click();
    assert.equal(await page.evaluate(() => window.copied), 'unchanged clipboard');
    assert.match(await page.locator('#status').textContent(), /Write a draft first/);
    assert.deepEqual(remoteRequests, [], 'offline mode makes no non-page requests');
    await page.locator('#configure-ai').click();
    assert.equal(await page.locator('#ai-settings').evaluate(el => el.open), true);
    assert.equal(await page.locator('#extension-origin').textContent(), 'chrome-extension://test-extension');
    await page.locator('#check-ollama').click();
    assert.match(await page.locator('#connection-status').textContent(), /Enable Use local Ollama/);
    await page.evaluate(() => { window.denyPermission = true; });
    await page.locator('#ollama').click();
    await page.waitForFunction(() => !document.getElementById('ollama').disabled);
    assert.equal(await page.locator('#ollama').isChecked(), false);
    assert.match(await page.locator('#connection-status').textContent(), /permission was declined/);
    assert.deepEqual(remoteRequests, []);
    await page.evaluate(() => { window.denyPermission = false; });
    await page.locator('#ollama').check();
    await page.waitForFunction(() => !document.getElementById('ollama').disabled);
    await page.route('http://localhost:11434/api/tags', route => route.fulfill({ json: { models: [{ name: 'qwen2.5:3b' }, { name: 'gpt-oss:120b-cloud' }] } }));
    await page.locator('#check-ollama').click();
    await page.waitForFunction(() => document.getElementById('connection-status').textContent.includes('Connected.'));
    assert.equal(await page.locator('#model').inputValue(), 'qwen2.5:3b');
    assert.equal(await page.locator('#models option').count(), 1);
    await page.locator('#body').fill('Please investigate this error.');
    await page.route('http://localhost:11434/api/chat', async route => {
      const data = route.request().postDataJSON();
      assert.equal(data.model, 'qwen2.5:3b');
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
    await page.waitForFunction(() => document.getElementById('improve-status').textContent.includes('404'));
    assert.equal(await page.locator('#body').inputValue(), 'Please investigate this error.');
    // Connection errors are visible beside Improve instead of below the whole form.
    assert.equal(await page.locator('#review').isVisible(), false);
    await page.unroute('http://localhost:11434/api/chat');
    let release;
    await page.route('http://localhost:11434/api/chat', async route => {
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ json: { message: { content: 'A stale suggestion' } } }).catch(() => {});
    });
    await page.locator('#improve').click();
    await page.locator('#cancel').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.getElementById('improve').disabled);
    // Let the request reach the route before cancelling it.
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    await page.locator('#cancel').click(); release();
    await page.waitForFunction(() => !document.getElementById('improve').disabled);
    assert.match(await page.locator('#improve-status').textContent(), /cancelled or timed out/);
    assert.equal(await page.locator('#review').isVisible(), false);
    assert.equal(await page.locator('#body').inputValue(), 'Please investigate this error.');
    await page.locator('#ollama').uncheck();
    await page.waitForFunction(() => document.getElementById('engine').textContent === 'Offline rules');
    await page.setViewportSize({ width: 280, height: 850 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'narrow panel must not overflow');
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: collapsible keyboard-accessible sections and persistence, visible Improve results, fixed Louis sign-off, legacy migration, 18 templates, persistence, themes, icon, permission denial, model discovery, mocked Ollama success/error/cancellation, narrow layout.');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
