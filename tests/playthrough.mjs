/* Desktop and iPhone. Designs a system, awakens life, flies, scans, and hears a signal.
   Also checks the SavagePlanets wordmark and mark are not stretched. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, devices } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };

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

async function assertBrand(page) {
  const logo = page.locator('#present img.wordmark');
  const nat = await logo.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight, alt: el.alt }));
  if (nat.w !== 588 || nat.h !== 420) throw new Error('wordmark intrinsic ' + nat.w + 'x' + nat.h);
  if (nat.alt !== 'SavagePlanets') throw new Error('wordmark alt ' + nat.alt);
  const box = await logo.boundingBox();
  const vp = page.viewportSize();
  if (!box || box.width < 40) throw new Error('wordmark not on screen');
  if (box.x < -1 || box.y < -1 || box.x + box.width > vp.width + 1 || box.y + box.height > vp.height + 1) {
    throw new Error('logo clipped by the viewport ' + JSON.stringify({ box, vp }));
  }
  const ratio = box.width / box.height;
  if (Math.abs(ratio - (588 / 420)) > 0.05) throw new Error('wordmark stretched ' + ratio.toFixed(3));
  const mark = page.locator('#sp-mark img.brand.mark');
  const m = await mark.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight, alt: el.alt }));
  if (m.w !== 512 || m.h !== 512 || m.alt !== 'SavagePlanets') throw new Error('corner mark ' + JSON.stringify(m));
  const mb = await mark.boundingBox();
  if (!mb || Math.abs(mb.width - mb.height) > 1.5) throw new Error('corner mark not square');
  const planets = await page.locator('.sp-word span').first().evaluate((el) => getComputedStyle(el).color);
  const savage = await page.locator('.sp-word').first().evaluate((el) => getComputedStyle(el).color);
  if (planets !== 'rgb(224, 58, 58)') throw new Error('Planets color ' + planets);
  if (savage !== 'rgb(238, 237, 231)') throw new Error('Savage color ' + savage);
  const html = await page.content();
  if (html.includes('Savage Planets')) throw new Error('brand was split with a space');
  if (!html.includes('SavagePlanets')) throw new Error('brand name missing');
}

async function voyage(page, name) {
  const click = async (sel) => page.click(sel, { timeout: 15000 });
  await page.waitForSelector('#present.show');
  await assertBrand(page);
  await page.locator('#present').dispatchEvent('pointerdown');
  await page.waitForSelector('#title:not([hidden])');
  await click('#begin');
  await page.waitForSelector('#atelier:not([hidden])');
  await page.waitForFunction(() => window.__sky && window.__sky.w >= 4096 && window.__sky.dpr >= 2, null, { timeout: 20000 });
  const sky = await page.evaluate(() => window.__sky);
  if (name === 'desktop' && sky.w < 8000) throw new Error('desktop sky is ' + sky.w + ' px wide');
  if (name !== 'desktop' && sky.w !== 4096) throw new Error('phone sky is ' + sky.w + ' px wide');
  if (sky.dpr < 2) throw new Error('pixel ratio ' + sky.dpr);
  const gate = await page.locator('#gate-mark').boundingBox();
  if (!gate || Math.abs(gate.width - gate.height) > 1.5) throw new Error('gate mark not square');
  await page.waitForSelector('#hz-readout');
  const hz = await page.locator('#hz-readout').innerText();
  if (!hz.includes('AU')) throw new Error('habitable zone missing');
  await click('#to-worlds');
  await page.waitForSelector('#teq');
  const teq = await page.locator('#teq').innerText();
  if (!teq.includes('K') || !teq.includes('yr')) throw new Error('physics card ' + teq);
  await page.fill('#world-name', 'Home');
  await click('#to-moons');
  await click('#add-moon');
  await page.waitForSelector('#roche-note');
  await click('#to-awaken');
  await click('#do-evolve');
  await page.waitForFunction(() => {
    const el = document.getElementById('life-card');
    return el && /technological|microbial|complex|Water-carbon|solvent/.test(el.textContent);
  });
  await click('#launch');
  await page.waitForSelector('#flight-hud:not([hidden])');
  await page.waitForFunction(() => {
    const img = document.querySelector('#ship-card img');
    return img && img.complete && img.naturalWidth === 1280 && img.naturalHeight === 720;
  });
  await page.waitForFunction(() => /in orbit/.test(document.getElementById('flight-readout').textContent), null, { timeout: 20000 });
  await click('#act-land');
  await click('#act-scan');
  await page.waitForFunction(() => /Density/.test(document.getElementById('scan-card').textContent) && /Temperature/.test(document.getElementById('scan-card').textContent));
  await click('#scan-close');
  await click('#act-contact');
  await page.waitForFunction(() => /Stillwater|18 years|technological/.test(document.getElementById('contact-card').textContent));
  await click('#contact-close');
  await click('#act-codex');
  await page.waitForSelector('#codex:not([hidden])');
  const brand = await page.locator('#codex-brand').innerText();
  if (brand.includes('Savage Planets') || !brand.includes('SavagePlanets')) throw new Error('codex brand ' + brand);
  const html = await page.content();
  if (html.includes('Savage Planets')) throw new Error('spaced brand after play');
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
  for (const [name, contextOptions] of [
    ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
    ['iphone', { ...devices['iPhone 13'], hasTouch: true, deviceScaleFactor: 3 }],
    ['iphone-land', { ...devices['iPhone 13 landscape'], hasTouch: true, deviceScaleFactor: 3 }]
  ]) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    try {
      await voyage(page, name);
      const real = errors.filter((e) => !/favicon|ReadPixels|GL Driver|AudioContext/i.test(e));
      console.log(name, real.length ? 'FAIL' : 'PASS', real.slice(0, 3).join(' | '));
      if (real.length) failed++;
    } catch (err) {
      failed++;
      console.log(name, 'FAIL', err.message.split('\n')[0]);
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failed) process.exit(1);
console.log('playthrough passed');
