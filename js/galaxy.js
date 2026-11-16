/* One shared galaxy. Events are append-only and merged by id.
   Names are cleaned. Beacons may only use a fixed list of phrases. */
import { cleanText } from './text.js';

export const GALAXY_KEY = 'cosmic-odyssey-galaxy-c4e91b07a6d2583f';
export const GALAXY_NTFY = 'https://ntfy.sh/cosmic-odyssey-galaxy-c4e91b07a6d2583f';
const TEXTDB = 'https://textdb.dev/api/data/';
const CAP = 80;

export const PHRASES = [
  'Clear skies on your watch',
  'The Loom holds',
  'Water is rising',
  'A light left for you',
  'Come share the harvest',
  'The relay is listening'
];

export const GENESIS = [
  {
    id: 'seed-stillwater',
    kind: 'colony',
    by: 'Ilya Voss',
    sid: 'seed',
    systemId: 'quiet-harbor',
    planetId: 'harbor-c',
    name: 'Stillwater',
    pop: 1400,
    ts: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'project-long-relay',
    kind: 'project',
    projectId: 'long-relay',
    name: 'The Long Relay',
    by: 'Mara Quill',
    sid: 'seed',
    need: 80,
    have: 22,
    unit: 'metals',
    ts: '2026-01-02T00:00:00.000Z'
  }
];

export function validateEvent(raw) {
  const kind = ['colony', 'visit', 'gift', 'project', 'beacon'].includes(raw.kind) ? raw.kind : '';
  if (!kind) return null;
  const phrase = PHRASES.includes(raw.phrase) ? raw.phrase : '';
  if (kind === 'beacon' && !phrase) return null;
  const id = cleanText(raw.id || '', 40).replace(/[^\w-]/g, '').slice(0, 40);
  if (!id) return null;
  return {
    id,
    kind,
    by: cleanText(raw.by || 'Explorer', 24) || 'Explorer',
    sid: cleanText(raw.sid || '', 24).replace(/[^\w-]/g, '').slice(0, 24),
    systemId: cleanText(raw.systemId || '', 32).replace(/[^\w-]/g, '').slice(0, 32),
    planetId: cleanText(raw.planetId || '', 32).replace(/[^\w-]/g, '').slice(0, 32),
    name: cleanText(raw.name || '', 32),
    projectId: cleanText(raw.projectId || '', 32).replace(/[^\w-]/g, '').slice(0, 32),
    amount: Math.max(0, Math.min(40, Number(raw.amount) || 0)),
    pop: Math.max(0, Math.min(1e7, Number(raw.pop) || 0)),
    phrase,
    ts: raw.ts || new Date().toISOString()
  };
}

export function mergeEvents(lists) {
  const map = new Map();
  lists.flat().forEach((raw) => {
    const ev = raw && raw.id && raw.kind ? (validateEvent(raw) || null) : null;
    const use = ev || (raw && raw.id && GENESIS.some((g) => g.id === raw.id) ? raw : null);
    if (use && use.id) map.set(use.id, use);
  });
  return [...map.values()].sort((a, b) => String(a.ts).localeCompare(String(b.ts))).slice(-CAP);
}

export function projectProgress(events, projectId) {
  const base = events.find((e) => e.kind === 'project' && e.projectId === projectId && e.need);
  const need = base ? base.need : 80;
  const have = events
    .filter((e) => e.kind === 'project' && (e.projectId === projectId || e.id === 'project-' + projectId))
    .reduce((sum, e) => sum + (e.amount || e.have || 0), 0);
  return { need, have: Math.min(need, have), name: base ? base.name : 'The Long Relay' };
}

async function getDoc() {
  const res = await fetch(TEXTDB + encodeURIComponent(GALAXY_KEY) + '?_=' + Date.now(), { cache: 'no-store' });
  if (res.status === 404) return { v: 1, events: [] };
  if (!res.ok) throw new Error('galaxy ' + res.status);
  const txt = await res.text();
  if (!txt.trim()) return { v: 1, events: [] };
  const doc = JSON.parse(txt);
  return { v: 1, events: Array.isArray(doc.events) ? doc.events : [] };
}

export async function loadGalaxy() {
  try {
    const doc = await getDoc();
    return mergeEvents([GENESIS, doc.events]);
  } catch (err) {
    return mergeEvents([GENESIS]);
  }
}

export async function appendEvent(raw) {
  const ev = validateEvent(raw);
  if (!ev) throw new Error('That note is not on the list.');
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await getDoc();
    if (!doc.events.some((e) => e && e.id === ev.id)) {
      doc.events.push(ev);
      doc.events = mergeEvents([doc.events]).filter((e) => !GENESIS.some((g) => g.id === e.id));
      doc.updated = new Date().toISOString();
      const res = await fetch(TEXTDB + encodeURIComponent(GALAXY_KEY), {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(doc)
      });
      if (!res.ok) throw new Error('save ' + res.status);
    }
    await new Promise((r) => setTimeout(r, 300));
    const check = await getDoc();
    if (check.events.some((e) => e && e.id === ev.id)) {
      try { await fetch(GALAXY_NTFY, { method: 'POST', body: JSON.stringify(ev) }); } catch (err) { /* mirror */ }
      return ev;
    }
  }
  throw new Error('The galaxy log did not keep that.');
}
