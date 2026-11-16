/* Shared universes and the Armada. Same idea as the arcade's feedback store:
   one JSON document on textdb.dev, no account, read → append → write → verify.
   ntfy.sh keeps a 12-hour mirror so a lost race can be repaired by the reader. */
import { cleanText } from './text.js';

export const TEXTDB = 'https://textdb.dev/api/data/';
export const UNIVERSE_KEY = 'cosmic-odyssey-universes-a4d18e62c0b75f39';
export const ARMADA_KEY = 'cosmic-odyssey-armada-b7e04c19d6a2835e';
export const NTFY_UNI = 'https://ntfy.sh/cosmic-odyssey-uni-9b14e0c58a27d6f3';
const CAP = 40;

function url(key) { return TEXTDB + encodeURIComponent(key); }

async function getDoc(key) {
  const res = await fetch(url(key) + '?_=' + Date.now(), { cache: 'no-store' });
  if (res.status === 404) return { v: 1, items: [] };
  if (!res.ok) throw new Error('catalog ' + res.status);
  const txt = await res.text();
  if (!txt.trim()) return { v: 1, items: [] };
  let doc = JSON.parse(txt);
  if (Array.isArray(doc)) doc = { v: 1, items: doc };
  if (!doc || !Array.isArray(doc.items)) throw new Error('catalog was not a list');
  return doc;
}

async function putDoc(key, doc) {
  const res = await fetch(url(key), {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify(doc)
  });
  if (!res.ok) throw new Error('save ' + res.status);
}

function num(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function sanitizeUniverse(raw) {
  const planets = (Array.isArray(raw.planets) ? raw.planets : []).slice(0, 4).map((p, i) => ({
    id: cleanText(p.id || ('p' + (i + 1)), 24).replace(/[^\w-]/g, '') || ('p' + (i + 1)),
    name: cleanText(p.name || ('World ' + (i + 1)), 28),
    aAU: num(p.aAU, 0.01, 40, 1),
    mass: num(p.mass, 0.05, 20, 1),
    radius: num(p.radius, 0.3, 3, 1),
    atmosphere: ['none', 'co2', 'n2o2', 'hhe'].includes(p.atmosphere) ? p.atmosphere : 'co2',
    pressure: num(p.pressure, 0, 30, 1),
    water: num(p.water, 0, 1, 0.3),
    albedo: num(p.albedo, 0.05, 0.85, 0.3),
    greenhouse: num(p.greenhouse, 0, 2, 0.8),
    moon: !!p.moon,
    life: num(p.life, 0, 1, 0)
  }));
  return {
    v: 1,
    kind: 'universe',
    id: cleanText(raw.id || '', 40).replace(/[^\w-]/g, '').slice(0, 40),
    name: cleanText(raw.name || 'Untitled universe', 42),
    author: cleanText(raw.author || 'Astro-Explorer', 32),
    about: cleanText(raw.about || '', 180),
    challenge: cleanText(raw.challenge || '', 140),
    goal: raw.goal && raw.goal.type ? {
      type: ['survey', 'land', 'habitable'].includes(raw.goal.type) ? raw.goal.type : 'survey',
      planet: cleanText(raw.goal.planet || (planets[0] ? planets[0].id : ''), 24)
    } : { type: 'survey', planet: planets[0] ? planets[0].id : '' },
    star: {
      mass: num(raw.star && raw.star.mass, 0.08, 2.2, 1),
      L: num(raw.star && raw.star.L, 0.0004, 8, 1),
      teff: num(raw.star && raw.star.teff, 2200, 9000, 5600),
      spectral: cleanText(raw.star && raw.star.spectral, 8) || 'G',
      radius: num(raw.star && raw.star.radius, 0.1, 2.5, 1)
    },
    planets,
    actualized: !!raw.actualized,
    nebula: [0.25, 0.2, 0.28],
    ts: new Date().toISOString(),
    test: !!raw.test
  };
}

export function sanitizeShip(raw) {
  return {
    v: 1,
    kind: 'ship',
    id: cleanText(raw.id || '', 40).replace(/[^\w-]/g, '').slice(0, 40),
    name: cleanText(raw.name || 'Unnamed ship', 32),
    author: cleanText(raw.author || 'Astro-Explorer', 32),
    hull: ['dart', 'ring', 'hauler'].includes(raw.hull) ? raw.hull : 'dart',
    primary: /^#[0-9a-fA-F]{6}$/.test(raw.primary || '') ? raw.primary : '#c5d0d8',
    accent: /^#[0-9a-fA-F]{6}$/.test(raw.accent || '') ? raw.accent : '#e25b1a',
    ts: new Date().toISOString(),
    test: !!raw.test
  };
}

async function publish(key, ntfy, record) {
  let last = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await getDoc(key);
    if (!doc.items.some((item) => item && item.id === record.id)) {
      doc.items.push(record);
      doc.items.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
      if (doc.items.length > CAP) doc.items = doc.items.slice(-CAP);
      doc.updated = new Date().toISOString();
      await putDoc(key, doc);
    }
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 500));
    const check = await getDoc(key);
    if (check.items.some((item) => item && item.id === record.id)) {
      try {
        await fetch(ntfy, { method: 'POST', body: JSON.stringify(record) });
      } catch (err) { /* mirror is best-effort */ }
      return record;
    }
    last = new Error('the catalog did not keep the entry');
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  throw last || new Error('publish failed');
}

export function publishUniverse(raw) {
  const record = sanitizeUniverse(raw);
  if (!record.id) record.id = 'u-' + Math.random().toString(16).slice(2, 10);
  if (!record.planets.length) throw new Error('Add at least one world.');
  return publish(UNIVERSE_KEY, NTFY_UNI, record);
}

export function publishShip(raw) {
  const record = sanitizeShip(raw);
  if (!record.id) record.id = 's-' + Math.random().toString(16).slice(2, 10);
  return publish(ARMADA_KEY, NTFY_UNI, record);
}

export async function listUniverses() {
  const doc = await getDoc(UNIVERSE_KEY);
  return doc.items.filter((item) => item && item.kind !== 'ship' && item.planets);
}

export async function listShips() {
  const doc = await getDoc(ARMADA_KEY);
  return doc.items.filter((item) => item && item.name && item.hull);
}
