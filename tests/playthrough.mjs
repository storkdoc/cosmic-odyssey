/* Desktop and iPhone. Opens the starfield, picks a star, tunes it, and zooms.
   Also checks the SavagePlanets wordmark and mark are not stretched. */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { chromium, webkit, devices } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon' };

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

async function sample(page, x, y) {
  const png = await page.screenshot({ type: 'png' });
  await writeFile('/tmp/odyssey-shot.png', png);
  const text = execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open('/tmp/odyssey-shot.png')\np=im.getpixel((${x},${y}))\nprint(p[0], p[1], p[2])`]).toString().trim().split(/\s+/).map(Number);
  return text;
}

async function platePixels(page, minCore = 80) {
  await page.waitForFunction(() => {
    const v = document.querySelector('#plate-bank video');
    return window.__plateReady === '1' && v && v.currentTime > 0.15 && /pack\.mp4/.test(v.currentSrc || '');
  }, null, { timeout: 15000 });
  const spot = await page.evaluate(() => {
    const plate = window.__pose.plates[0];
    return {
      dpr: window.devicePixelRatio,
      core: { x: plate.cx, y: plate.cy },
      corner: { x: plate.cornerX, y: plate.cornerY },
      src: document.querySelector('#plate-bank video').currentSrc
    };
  });
  if (!/g-star-pack\.mp4/.test(spot.src) && !/star-pack\.mp4/.test(spot.src)) throw new Error('plate source ' + spot.src);
  const core = await sample(page, Math.round(spot.core.x * spot.dpr), Math.round(spot.core.y * spot.dpr));
  if (core[0] < minCore) throw new Error('star core is not lit ' + core.join(','));
  const sx = Math.round(spot.corner.x * spot.dpr);
  const sy = Math.round(spot.corner.y * spot.dpr);
  const covered = await sample(page, sx, sy);
  await page.evaluate(() => { window.__hidePlates = true; });
  await page.waitForTimeout(120);
  const field = await sample(page, sx, sy);
  await page.evaluate(() => { window.__hidePlates = false; });
  for (let i = 0; i < 3; i++) {
    if (Math.abs(covered[i] - field[i]) > 28) throw new Error('plate corner is a box ' + covered.join(',') + ' vs starfield ' + field.join(','));
  }
  if (covered[0] + covered[1] + covered[2] < 8 && field[0] + field[1] + field[2] > 24) {
    throw new Error('plate corner is black ' + covered.join(','));
  }
  return spot;
}

async function assertFilmClear(page) {
  await platePixels(page);
  const loops = await page.evaluate(() => document.querySelector('#plate-bank video').loop);
  if (!loops) throw new Error('the plate does not loop');
  await page.evaluate(() => {
    const v = document.querySelector('#plate-bank video');
    v.currentTime = Math.max(0, v.duration - 0.08);
  });
  await page.waitForFunction(() => {
    const v = document.querySelector('#plate-bank video');
    return v.currentTime < 0.45;
  }, null, { timeout: 4000 });
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
  const touchSurface = await page.evaluate(() => {
    const el = document.elementFromPoint(Math.round(window.innerWidth * 0.72), 130);
    const gesture = document.getElementById('gesture');
    const meta = document.querySelector('meta[name="viewport"]').content;
    const blocked = document.createEvent ? true : false;
    const start = new Event('gesturestart', { bubbles: true, cancelable: true });
    document.dispatchEvent(start);
    return {
      hit: el && el.id,
      action: getComputedStyle(gesture).touchAction,
      meta,
      gestureBlocked: start.defaultPrevented,
      blocked
    };
  });
  if (touchSurface.hit !== 'gesture') throw new Error('touches hit ' + touchSurface.hit + ' instead of the map');
  if (touchSurface.action !== 'none') throw new Error('touch-action ' + touchSurface.action);
  if (!/user-scalable=no/.test(touchSurface.meta) || !/maximum-scale=1/.test(touchSurface.meta)) throw new Error('viewport ' + touchSurface.meta);
  if (!touchSurface.gestureBlocked) throw new Error('gesture zoom was not blocked');
  const overlay = await page.evaluate(() => !!document.getElementById('g-film') || !!document.querySelector('.plate-slot'));
  if (overlay) throw new Error('a video overlay is still in the page');
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
  await page.waitForFunction(() => {
    const now = window.__spin || 0;
    if (window.__spinMark == null) { window.__spinMark = now; return false; }
    return now > window.__spinMark + 0.04;
  }, null, { timeout: 5000 });
  await page.locator('#feat-mass').evaluate((el) => {
    el.value = el.max;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const after = await page.locator('#derived-l').innerText();
  if (after === before) throw new Error('mass slider did not change luminosity');
  if (await page.locator('#type-badge').getAttribute('data-type') !== 'g') throw new Error('mass slider changed the type');
  const teff = parseFloat((await page.locator('#derived-t').innerText()).replace(/,/g, ''));
  if (!(teff >= 5300 && teff <= 6000)) throw new Error('G temperature left its type ' + teff);
  await assertFilmClear(page);
  const held = await page.evaluate(() => window.__pose.dist);
  await page.waitForTimeout(450);
  const held2 = await page.evaluate(() => window.__pose.dist);
  if (Math.abs(held2 - held) > 0.2) throw new Error('the camera zoomed on its own ' + held + ' ' + held2);
  if (await page.evaluate(() => window.__pose.tilt) !== 0) throw new Error('camera is not top-down');
  const pan0 = await page.evaluate(() => window.__pose.panX);
  const viewBox = await page.locator('#view').boundingBox();
  await page.mouse.move(viewBox.x + viewBox.width * 0.72, viewBox.y + 160);
  await page.mouse.down();
  await page.mouse.move(viewBox.x + viewBox.width * 0.72 + 140, viewBox.y + 160, { steps: 12 });
  await page.mouse.up();
  const pan1 = await page.evaluate(() => window.__pose.panX);
  if (Math.abs(pan1 - pan0) < 0.05) throw new Error('drag did not pan ' + pan0 + ' ' + pan1);
  if (await page.evaluate(() => window.__pose.tilt) !== 0) throw new Error('drag tilted the camera');
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
  await page.waitForFunction(() => window.__pose && window.__pose.mode === 'system' && window.__pose.tilt === 0);
  const framed = await page.evaluate(() => window.__pose);
  if (framed.count > 0) {
    if (framed.count > 1 && !(framed.orbits >= 1)) throw new Error('orbit rings missing');
    if (!(framed.hz)) throw new Error('habitable zone missing');
    if (framed.plates && framed.plates[0] && framed.plates[0].w < 48) throw new Error('star plate is a speck ' + framed.plates[0].w);
    const pace = await page.evaluate(() => window.__orbitSeconds);
    if (!(pace >= 60 && pace <= 90)) throw new Error('orbits are not calm ' + pace);
    if (await page.evaluate(() => window.__planets) !== 0) throw new Error('placeholder planets are still drawn');
    if (!(framed.dist > framed.extent * 0.8 && Math.abs(framed.dist - framed.fit) / framed.fit < 0.25)) {
      throw new Error('the map is not framed ' + framed.dist + ' fit ' + framed.fit + ' extent ' + framed.extent);
    }
  }
  if (await page.evaluate(() => window.__pose.tilt) !== 0) throw new Error('the map tilted');
  if (name !== 'desktop') {
    const sheet = await page.locator('#next .sheet').boundingBox();
    const phone = page.viewportSize();
    if (!sheet || sheet.height > phone.height * 0.25) throw new Error('selection panel covers the map ' + (sheet && sheet.height));
  }
  const next = await page.locator('#next-copy').innerText();
  if (!/Next: planets/.test(next)) throw new Error('next chapter ' + next);
  if (/Placeholder/.test(next)) throw new Error('placeholder copy remains');
  if (many === '2' && !/Holman/.test(next)) throw new Error('binary note ' + next);
  if (many === '2') {
    await page.waitForFunction(() => {
      const world = window.__pose && window.__pose.world;
      if (!world || world.length !== 2) return false;
      const srcs = window.__plateSrcs || [];
      return srcs.some((s) => s.includes('g-star-pack')) && srcs.some((s) => s.includes('k-star-pack'));
    }, null, { timeout: 15000 });
    const crossed = await page.evaluate(() => {
      const world = window.__pose.world;
      const d = Math.hypot(world[0].x - world[1].x, world[0].z - world[1].z);
      return d <= world[0].r + world[1].r ? d : '';
    });
    if (crossed) throw new Error('binary stars overlap');
    await page.waitForSelector('#paths:not([hidden])');
    if (await page.evaluate(() => window.__paths) !== true) throw new Error('orbits did not start on');
    await click('#paths');
    if (await page.evaluate(() => window.__paths) !== false) throw new Error('orbit toggle did not hide paths');
    if (await page.evaluate(() => window.__pose.hz) !== false) throw new Error('orbit toggle left the habitable zone up');
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
  async function confirmStars(page, count) {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.click(`.count-card[data-count="${count}"]`);
    for (const type of ['g', 'k', 'm'].slice(0, count)) {
      await page.waitForSelector('#studio:not([hidden]) .star-card');
      await page.click(`.star-card[data-type="${type}"]`);
      await page.click('#confirm-star');
    }
    await page.evaluate((n) => { window.__want = n; }, count);
    await page.waitForFunction(() => {
      const pose = window.__pose;
      return pose && pose.mode === 'system' && pose.world && pose.world.length === window.__want && window.__plateReady === '1';
    }, null, { timeout: 20000 });
    if (count > 1) {
      const hit = await page.evaluate(() => {
        const world = window.__pose.world;
        for (let i = 0; i < world.length; i++) {
          for (let j = i + 1; j < world.length; j++) {
            const d = Math.hypot(world[i].x - world[j].x, world[i].z - world[j].z);
            if (d <= world[i].r + world[j].r + 1e-3) return d + ' <= ' + world[i].r + ' + ' + world[j].r;
          }
        }
        return '';
      });
      if (hit) throw new Error('star disks intersect ' + hit);
    }
    await platePixels(page, 36);
  }
  for (const count of [1, 3]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.log('plate', count, String(err).split('\n')[0]));
    try {
      await confirmStars(page, count);
      console.log('clear-chrome', count, 'PASS');
    } catch (err) {
      failed++;
      console.log('clear-chrome', count, 'FAIL', err.message.split('\n')[0]);
    }
    await context.close();
  }
  try {
    const kit = await webkit.launch({ headless: true });
    for (const count of [1, 3]) {
      const context = await kit.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('pageerror', (err) => console.log('wk plate', count, String(err).split('\n')[0]));
      try {
        await confirmStars(page, count);
        console.log('clear-webkit', count, 'PASS');
      } catch (err) {
        failed++;
        console.log('clear-webkit', count, 'FAIL', err.message.split('\n')[0]);
      }
      await context.close();
    }
    await kit.close();
  } catch (err) {
    failed++;
    console.log('clear-webkit', 'FAIL', err.message.split('\n')[0]);
  }
  const iphone = { ...devices['iPhone 13'], hasTouch: true, isMobile: true };
  try {
    const context = await browser.newContext(iphone);
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await assertFingers(page, 'iphone-cdp');
    await context.close();
  } catch (err) {
    failed++;
    console.log('iphone-cdp', 'FAIL', err.message.split('\n')[0]);
  }
  try {
    const kit = await webkit.launch({ headless: true });
    const context = await kit.newContext(iphone);
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await assertFingers(page, 'iphone-webkit');
    await context.close();
    await kit.close();
  } catch (err) {
    failed++;
    console.log('iphone-webkit', 'FAIL', err.message.split('\n')[0]);
  }
} finally {
  await browser.close();
  server.close();
}
async function finger(page, steps) {
  try {
    const cdp = await page.context().newCDPSession(page);
    for (const step of steps) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: step.type,
        touchPoints: step.points.map((point) => ({ x: point.x, y: point.y, id: point.id }))
      });
      if (step.wait) await page.waitForTimeout(step.wait);
    }
    return 'cdp';
  } catch (err) { /* WebKit has no touch CDP, so the page receives the fallback events. */ }
  await page.evaluate(async (script) => {
    const target = document.getElementById('gesture');
    const listFor = (points) => {
      if (document.createTouch && document.createTouchList) {
        return document.createTouchList(...points.map((point) => document.createTouch(
          window, target, point.id, point.x, point.y, point.x, point.y
        )));
      }
      return points.map((point) => new Touch({
        identifier: point.id, target, clientX: point.x, clientY: point.y, pageX: point.x, pageY: point.y, radiusX: 8, radiusY: 8, force: 1
      }));
    };
    const empty = () => (document.createTouchList ? document.createTouchList() : []);
    const fire = (type, points) => {
      const dom = { touchStart: 'touchstart', touchMove: 'touchmove', touchEnd: 'touchend', touchCancel: 'touchcancel' }[type] || type;
      const ended = dom === 'touchend' || dom === 'touchcancel';
      const list = ended ? empty() : listFor(points);
      target.dispatchEvent(new TouchEvent(dom, {
        bubbles: true,
        cancelable: true,
        touches: list,
        targetTouches: list,
        changedTouches: list
      }));
    };
    for (const step of script) {
      fire(step.type, step.points);
      if (step.wait) await new Promise((resolve) => setTimeout(resolve, step.wait));
    }
  }, steps);
  return 'touch';
}

async function until(page, pred) {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (await page.evaluate(pred)) return;
    await page.waitForTimeout(40);
  }
  const pose = await page.evaluate(() => ({
    target: window.__pose && window.__pose.target,
    dist: window.__pose && window.__pose.dist,
    pan: window.__pose && window.__pose.panX,
    mark: window.__mark
  }));
  throw new Error('timed out ' + JSON.stringify(pose));
}

async function assertFingers(page, label) {
  await page.waitForSelector('#gesture');
  await page.waitForFunction(() => window.__pose && window.__pose.dist > 0);
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(Math.round(window.innerWidth * 0.55), 150);
    return el && el.id;
  });
  if (hit !== 'gesture') throw new Error(label + ' hit ' + hit);
  const open = await page.evaluate(() => window.__pose.target);
  await page.click('#zoom-in');
  await page.evaluate((start) => { window.__mark = start; }, open);
  await until(page, () => window.__pose.target < window.__mark * 0.9);
  const before = await page.evaluate(() => ({ dist: window.__pose.dist, pan: window.__pose.panX, tilt: window.__pose.tilt, target: window.__pose.target }));
  await page.evaluate(() => {
    const target = document.getElementById('gesture');
    const fire = (type, id, px, py) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: px, clientY: py, isPrimary: id === 7
    }));
    fire('pointerdown', 7, 150, 150);
    fire('pointerdown', 8, 150, 230);
    fire('pointermove', 7, 150, 90);
    fire('pointermove', 8, 150, 310);
    fire('pointerup', 7, 150, 90);
    fire('pointerup', 8, 150, 310);
  });
  await page.evaluate((start) => { window.__mark = start; }, before.target);
  await until(page, () => window.__pose.target < window.__mark * 0.75);
  const pointed = await page.evaluate(() => window.__pose.target);
  const x = Math.round(page.viewportSize().width * 0.55);
  const y = 220;
  const pinch = [{ type: 'touchStart', points: [{ id: 1, x, y: y - 30 }, { id: 2, x, y: y + 30 }], wait: 40 }];
  for (let i = 1; i <= 6; i++) {
    const spread = 30 + i * 16;
    pinch.push({ type: 'touchMove', points: [{ id: 1, x, y: y - spread }, { id: 2, x, y: y + spread }], wait: 32 });
  }
  pinch.push({ type: 'touchEnd', points: [], wait: 50 });
  const via = await finger(page, pinch);
  await page.evaluate((start) => { window.__mark = start; }, pointed);
  await until(page, () => window.__pose.target < window.__mark * 0.72);
  if (await page.evaluate(() => window.__pose.tilt) !== 0) throw new Error(label + ' pinch tilted the camera');
  const pan0 = await page.evaluate(() => window.__pose.panX);
  const drag = [
    { type: 'touchStart', points: [{ id: 1, x, y }], wait: 30 }
  ];
  for (let i = 1; i <= 5; i++) drag.push({ type: 'touchMove', points: [{ id: 1, x: x - i * 28, y }], wait: 28 });
  drag.push({ type: 'touchEnd', points: [], wait: 40 });
  await finger(page, drag);
  await page.evaluate((start) => { window.__mark = start; }, pan0);
  await until(page, () => Math.abs(window.__pose.panX - window.__mark) > 0.08);
  const pan1 = await page.evaluate(() => window.__pose.panX);
  if (await page.evaluate(() => window.__pose.tilt) !== 0) throw new Error(label + ' drag tilted the camera');
  console.log(label, via, 'pinch', before.dist.toFixed(2), '->', (await page.evaluate(() => window.__pose.dist)).toFixed(2), 'pan', pan0.toFixed(2), '->', pan1.toFixed(2));
}

if (failed) process.exit(1);
console.log('playthrough passed');
