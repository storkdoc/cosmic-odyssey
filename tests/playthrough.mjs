/* Full voyage, desktop keyboard and iPhone touch. Serves the repo and drives the prompts. */
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
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.locator(selector).dispatchEvent('pointerdown');
  try { await until(); }
  finally { await page.locator(selector).dispatchEvent('pointerup'); }
}

async function voyage(page, touch) {
  const prompt = () => page.locator('#prompt').innerText();
  const waitPrompt = (part) => page.waitForFunction((p) => {
    const el = document.getElementById('prompt');
    return el && el.textContent.includes(p);
  }, part, { timeout: 45000 });

  await page.click('#begin');
  await page.keyboard.press('Escape');
  await waitPrompt('Hold W');

  if (touch) await holdTap(page, '#act-thrust', () => waitPrompt('Press L'));
  else await holdKey(page, 'KeyW', () => waitPrompt('Press L'));

  if (touch) await page.tap('#act-land');
  else await page.keyboard.press('KeyL');
  await waitPrompt('Hold Space');

  if (touch) await holdTap(page, '#act-mine', () => waitPrompt('Press B'));
  else await holdKey(page, 'Space', () => waitPrompt('Press B'));

  if (touch) await page.tap('#act-sail');
  else await page.keyboard.press('KeyB');
  await waitPrompt('Press T');

  if (touch) await page.tap('#act-cross');
  else await page.keyboard.press('KeyT');
  await waitPrompt('Press L to reach');

  if (touch) await page.tap('#act-land');
  else await page.keyboard.press('KeyL');
  await waitPrompt('Hold W to fly the drone');

  if (touch) await holdTap(page, '#act-thrust', () => waitPrompt('Hold R'));
  else await holdKey(page, 'KeyW', () => waitPrompt('Hold R'));

  if (touch) await holdTap(page, '#act-rescue', () => waitPrompt('Press F'));
  else await holdKey(page, 'KeyR', () => waitPrompt('Press F'));

  if (touch) await page.tap('#act-forge');
  else await page.keyboard.press('KeyF');
  await page.fill('#uni-name', 'Playtest Reach');
  await page.click('#publish-universe');
  await page.waitForFunction(() => {
    const s = document.getElementById('publish-status');
    return s && s.textContent.includes('Published');
  }, null, { timeout: 20000 });
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
    await page.goto(`http://127.0.0.1:${port}/?test=1`, { waitUntil: 'domcontentloaded' });
    try {
      await voyage(page, touch);
      console.log(name, 'PASS', errors.length ? 'console ' + errors.slice(0, 3).join(' | ') : 'clean');
      const real = errors.filter((e) => !/favicon|ReadPixels|GL Driver|AudioContext/i.test(e));
      if (real.length) { failed++; console.log('  errors', real.slice(0, 5)); }
    } catch (err) {
      failed++;
      console.log(name, 'FAIL', err.message);
      const shot = `/tmp/play-${name}.png`;
      await page.screenshot({ path: shot }).catch(() => {});
      console.log('  shot', shot, 'prompt', await page.locator('#prompt').innerText().catch(() => ''));
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failed) process.exit(1);
console.log('playthrough passed');
