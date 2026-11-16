/* Desktop keyboard and iPhone touch. Designs a system, flies, lands, builds,
   opens the Codex, and resolves a redacted contact. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, devices } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let path = decodeURIComponent(url.pathname);
        if (path.endsWith('/')) path += 'index.html';
        const file = normalize(join(ROOT, path));
        if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch (err) {
        res.writeHead(404); res.end('missing');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function holdKey(page, key, until) {
  await page.keyboard.down(key);
  try { await until(); }
  finally { await page.keyboard.up(key); }
}

async function holdTap(page, selector, until) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error('no box for ' + selector);
  await page.locator(selector).dispatchEvent('pointerdown');
  try { await until(); }
  finally { await page.locator(selector).dispatchEvent('pointerup'); }
}

async function voyage(page, touch) {
  const waitPrompt = (part) => page.waitForFunction((p) => {
    const el = document.getElementById('prompt');
    return el && el.textContent.includes(p);
  }, part, { timeout: 45000 });
  const press = async (key, sel) => {
    if (touch) await page.tap(sel);
    else await page.keyboard.press(key);
  };

  const click = async (sel) => page.click(sel, { timeout: 15000 });
  await click('#begin');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#design:not([hidden])');
  await click('#center-bh');
  await page.waitForFunction(() => document.getElementById('cosmic-clock').textContent.includes('50 million'));
  await click('#place-world');
  await page.waitForFunction(() => document.getElementById('life-guide').textContent.includes('Subsurface'));
  await click('#launch-system');

  await waitPrompt('Hold W');
  if (touch) await holdTap(page, '#act-thrust', () => waitPrompt('Press L'));
  else await holdKey(page, 'KeyW', () => waitPrompt('Press L'));
  await press('KeyL', '#act-land');
  await waitPrompt('Press C');
  await press('KeyC', '#act-colony');
  const dismissDiscovery = async () => {
    const text = await page.locator('#prompt').innerText();
    if (!text.includes('Press D')) return;
    await press('KeyD', '#act-codex');
    await page.waitForSelector('#codex-card:not([hidden])', { timeout: 5000 });
    await click('#codex-close');
  };

  await waitPrompt('Press H');
  await press('KeyH', '#act-habitat');
  await waitPrompt('Press D');
  await dismissDiscovery();

  await waitPrompt('Press O');
  await press('KeyO', '#act-log');
  await page.waitForFunction(() => {
    const list = document.getElementById('log-list');
    return list && list.textContent.includes('unexplained exchange') && !list.textContent.includes('Mara');
  });
  await click('#research-gw');
  await page.waitForFunction(() => document.getElementById('log-list').textContent.includes('Mara Quill'));
  await click('#flyby-seed');
  await page.waitForFunction(() => document.getElementById('flyby-card').textContent.includes('Stillwater'));

  await click('#log-close');
  await waitPrompt('Press V');
  await press('KeyV', '#act-visit');
  await waitPrompt('Press D');
  await dismissDiscovery();
  await waitPrompt('Press J');
  await press('KeyJ', '#act-joint');
  await page.waitForFunction(() => (document.getElementById('line-text').textContent || '').includes('share is in the relay'));
  await click('#open-ruler');
  await page.waitForSelector('#ruler:not([hidden])');
}

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
let failed = 0;
try {
  for (const [name, touch, contextOptions] of [
    ['desktop', false, { viewport: { width: 1440, height: 900 } }],
    ['iphone', true, { ...devices['iPhone 13'], hasTouch: true }]
  ]) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    try {
      await voyage(page, touch);
      const real = errors.filter((e) => !/favicon|ReadPixels|GL Driver|AudioContext/i.test(e));
      console.log(name, real.length ? 'FAIL' : 'PASS', real.slice(0, 3).join(' | '));
      if (real.length) failed++;
    } catch (err) {
      failed++;
      console.log(name, 'FAIL', err.message.split('\n')[0]);
      await page.screenshot({ path: `/tmp/play-${name}.png` }).catch(() => {});
      console.log('  prompt', await page.locator('#prompt').innerText().catch(() => ''));
      console.log('  clock', await page.locator('#cosmic-clock').innerText().catch(() => ''));
      console.log('  life', await page.locator('#life-guide').innerText().catch(() => ''));
      const real = errors.filter((e) => !/favicon|ReadPixels|GL Driver|AudioContext/i.test(e));
      if (real.length) console.log('  errors', real.slice(0, 4).join(' | '));
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failed) process.exit(1);
console.log('playthrough passed');
