/* Desktop and iPhone. Opens the starfield, picks a star, tunes it, and zooms.
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

async function assertLogo(page) {
  const logo = page.locator('#sp-mark img.brand.mark');
  const nat = await logo.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight, alt: el.alt }));
  if (nat.w !== 512 || nat.h !== 512) throw new Error('logo intrinsic ' + nat.w + 'x' + nat.h);
  if (nat.alt !== 'SavagePlanets') throw new Error('logo alt ' + nat.alt);
  const box = await logo.boundingBox();
  const vp = page.viewportSize();
  if (!box || box.width < 32) throw new Error('logo missing');
  if (box.x > 28 || box.y > 28) throw new Error('logo not top-left ' + JSON.stringify(box));
  if (box.x < -1 || box.y < -1 || box.x + box.width > vp.width + 1 || box.y + box.height > vp.height + 1) {
    throw new Error('logo outside the viewport');
  }
  if (Math.abs(box.width - box.height) > 1.5) throw new Error('logo not square');
  const link = page.locator('#sp-mark');
  if (await link.getAttribute('href') !== 'https://savageplanets.com') throw new Error('logo href');
  if (await link.getAttribute('target') !== '_blank') throw new Error('logo target');
  const problem = await page.evaluate(() => {
    const img = document.querySelector('#sp-mark img');
    if (img.scrollHeight > img.clientHeight + 1) return 'logo cropped';
    const r = img.getBoundingClientRect();
    const clips = (v) => v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll';
    let el = img.parentElement;
    while (el) {
      const s = getComputedStyle(el);
      if (clips(s.overflow) || clips(s.overflowX) || clips(s.overflowY)) {
        const a = el.getBoundingClientRect();
        if (r.top < a.top - 1 || r.bottom > a.bottom + 1 || r.left < a.left - 1 || r.right > a.right + 1) {
          return (el.id || el.tagName) + ' clips the logo';
        }
      }
      el = el.parentElement;
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!document.getElementById('sp-mark').contains(hit)) return 'logo covered by ' + (hit && (hit.id || hit.className || hit.tagName));
    const text = document.body.innerText;
    if (/presents/i.test(text)) return 'splash text';
    if (/gift for the backers/i.test(text)) return 'dedication card';
    if (text.includes('COSMIC ODYSSEY')) return 'title card';
    if (document.getElementById('present') || document.getElementById('title')) return 'splash section remains';
    return '';
  });
  if (problem) throw new Error(problem);
  const html = await page.content();
  if (html.includes('Savage Planets')) throw new Error('brand was split with a space');
}

async function voyage(page, name) {
  const click = async (sel) => page.click(sel, { timeout: 15000 });
  await page.waitForSelector('#count:not([hidden]) h2');
  await assertLogo(page);
  if (name === 'desktop') {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('#sp-mark')
    ]);
    await popup.close();
  }
  const asked = await page.locator('#count h2').innerText();
  if (!/how many stars/i.test(asked)) throw new Error('count step missing: ' + asked);
  const vp = page.viewportSize();
  const countBox = await page.locator('#count .sheet').boundingBox();
  if (name === 'desktop') {
    const frac = countBox.width / vp.width;
    if (countBox.x > 8 || frac < 0.32 || frac > 0.42) throw new Error('desktop panel not on the left ' + frac.toFixed(2));
  } else if (countBox.y < vp.height * 0.4) {
    throw new Error('phone panel is not a bottom sheet');
  }
  const choices = await page.locator('.count-card').count();
  if (choices !== 4) throw new Error('count cards ' + choices);
  const rogueLabel = await page.locator('.count-card[data-count="0"]').innerText();
  if (!/rogue|starless/i.test(rogueLabel)) throw new Error('rogue choice ' + rogueLabel);
  const many = name === 'desktop' ? '2' : '1';
  await click('.count-card[data-count="' + many + '"]');
  await page.waitForSelector('#studio:not([hidden])');
  await page.waitForSelector('#star-menu .star-card');
  const cards = await page.locator('.star-card').count();
  if (cards < 11) throw new Error('star menu has ' + cards + ' cards');
  for (const id of ['o', 'b', 'a', 'f', 'g', 'k', 'm', 'giant', 'wd', 'ns', 'bh']) {
    const n = await page.locator('.star-card[data-type="' + id + '"] canvas.mini').count();
    if (!n) throw new Error('missing live card ' + id);
  }
  await page.waitForFunction(() => window.__sky && window.__sky.w >= 4096 && window.__sky.dpr >= 2, null, { timeout: 20000 });
  const sky = await page.evaluate(() => window.__sky);
  if (name === 'desktop' && sky.w < 8000) throw new Error('desktop sky is ' + sky.w + ' px wide');
  if (name !== 'desktop' && sky.w !== 4096) throw new Error('phone sky is ' + sky.w + ' px wide');
  if (sky.dpr < 2) throw new Error('pixel ratio ' + sky.dpr);
  await click('.star-card[data-type="g"]');
  await page.waitForSelector('#features:not([hidden]) #feat-mass');
  if (await page.locator('#type-badge').getAttribute('data-type') !== 'g') throw new Error('type badge missing');
  const before = await page.locator('#derived-l').innerText();
  if (!before.includes('L')) throw new Error('luminosity missing ' + before);
  const hz = await page.locator('#derived-hz').innerText();
  if (!hz.includes('AU')) throw new Error('habitable zone missing ' + hz);
  const spin0 = await page.evaluate(() => window.__spin || 0);
  await page.waitForTimeout(700);
  const spin1 = await page.evaluate(() => window.__spin || 0);
  if (!(spin1 > spin0 + 0.04)) throw new Error('star mesh did not rotate ' + spin0 + ' ' + spin1);
  await page.locator('#feat-mass').evaluate((el) => {
    el.value = el.max;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const after = await page.locator('#derived-l').innerText();
  if (after === before) throw new Error('mass slider did not change luminosity');
  if (await page.locator('#type-badge').getAttribute('data-type') !== 'g') throw new Error('mass slider changed the type');
  const teff = parseFloat((await page.locator('#derived-t').innerText()).replace(/,/g, ''));
  if (!(teff >= 5300 && teff <= 6000)) throw new Error('G temperature left its type ' + teff);
  await page.waitForTimeout(400);
  const dist0 = parseFloat(await page.locator('#cam-dist').innerText());
  await click('#zoom-in');
  await click('#zoom-in');
  await page.waitForFunction((d0) => parseFloat(document.getElementById('cam-dist').textContent) < d0 - 0.35, dist0);
  await click('#mute');
  const pressed = await page.locator('#mute').getAttribute('aria-pressed');
  if (pressed !== 'true') throw new Error('mute did not toggle');
  await click('#confirm-star');
  if (many === '2') {
    await page.waitForFunction(() => /Star 2 of 2/.test(document.getElementById('which').textContent));
    await click('.star-card[data-type="k"]');
    await page.waitForSelector('#features:not([hidden]) #feat-mass');
    await click('#confirm-star');
  }
  await page.waitForSelector('#next:not([hidden])');
  const next = await page.locator('#next-copy').innerText();
  if (!/Next: planets/.test(next)) throw new Error('next chapter ' + next);
  if (many === '2' && !/Holman/.test(next)) throw new Error('binary note ' + next);
  if (many === '2') {
    await page.waitForSelector('#paths:not([hidden])');
    if (await page.evaluate(() => window.__paths) !== true) throw new Error('orbits did not start on');
    await click('#paths');
    if (await page.evaluate(() => window.__paths) !== false) throw new Error('orbit toggle did not hide paths');
    await page.waitForFunction(() => {
      const el = document.getElementById('cam-dist');
      const n = parseFloat(el.textContent);
      const prev = el.dataset.prev;
      el.dataset.prev = String(n);
      return prev != null && Math.abs(n - parseFloat(prev)) < 0.05;
    });
    const wide = parseFloat(await page.locator('#cam-dist').innerText());
    await click('#zoom-in');
    await click('#zoom-in');
    await page.waitForFunction((d0) => parseFloat(document.getElementById('cam-dist').textContent) < d0 - 0.08, wide);
  }
  const saved = await page.evaluate(() => localStorage.getItem('cosmic-odyssey.star'));
  if (!saved || !saved.includes('"type":"g"')) throw new Error('star was not saved');
  if (many === '2' && !saved.includes('"count":2')) throw new Error('binary was not saved');
  const html = await page.content();
  if (html.includes('Savage Planets')) throw new Error('spaced brand after play');
  if (html.includes('$')) throw new Error('payment language');
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
    ['logo-390x844', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
    ['logo-375x667', { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }],
    ['logo-390x664', { viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }]
  ]) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('#sp-mark img.brand.mark');
      await page.waitForSelector('#count:not([hidden])');
      await assertLogo(page);
      console.log(name, 'PASS');
    } catch (err) {
      failed++;
      console.log(name, 'FAIL', err.message.split('\n')[0]);
    }
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('#count:not([hidden])');
      await page.click('.count-card[data-count="0"]');
      await page.waitForSelector('#next:not([hidden])');
      const note = await page.locator('#next-copy').innerText();
      if (!/rogue|starless/i.test(note)) throw new Error(note);
      if (await page.locator('#paths').isVisible()) throw new Error('orbits shown with no stars');
      console.log('rogue', 'PASS');
    } catch (err) {
      failed++;
      console.log('rogue', 'FAIL', err.message.split('\n')[0]);
    }
    await context.close();
  }
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
