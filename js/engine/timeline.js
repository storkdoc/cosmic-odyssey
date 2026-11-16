/* The galactic ruler. Year 0 is fixed by the galaxy seed. Wall-clock time
   does not move it. See TIME.md. Positions are years. */

export const GALAXY_SEED = 20260101;
export const YEAR_0 = 0;
export const C_LY_PER_YEAR = 1;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIN_KINDS = ['supernova', 'grb', 'gw-scramble'];

/* Events are pinned to ruler positions. The same seed and index always agree. */
export function pinnedEvent(index, seed = GALAXY_SEED) {
  const rand = mulberry32((seed + index * 9973) >>> 0);
  const kind = PIN_KINDS[index % PIN_KINDS.length];
  return {
    id: 'pin-' + index,
    t: 5e8 + index * 2.5e7,
    kind,
    systemId: 'galaxy',
    x: rand() * 2 - 1,
    y: rand() * 2 - 1,
    cone: rand() * Math.PI * 2,
    coneWidth: 0.4
  };
}

export function pinsUpTo(t, seed = GALAXY_SEED) {
  const out = [];
  for (let n = 0; n < 80; n++) {
    const ev = pinnedEvent(n, seed);
    if (ev.t > t) break;
    out.push(ev);
  }
  return out;
}

export function createWindow({ systemId, start, cursor = start, end = cursor }) {
  if (cursor < start || end < cursor) throw new Error('A window cannot start ahead of its cursor.');
  return { systemId, start, cursor, end };
}

/* Play moves the cursor forward. The window only grows. */
export function advanceCursor(win, years) {
  if (!(years >= 0)) throw new Error('The cursor only moves forward.');
  const cursor = win.cursor + years;
  return { ...win, cursor, end: Math.max(win.end, cursor) };
}

export function validateGrowth(before, after) {
  return after.systemId === before.systemId
    && after.start === before.start
    && after.cursor >= before.cursor
    && after.end >= before.end
    && after.end >= after.cursor;
}

export function logoutSnapshot(win, state) {
  return {
    systemId: win.systemId,
    start: win.start,
    cursor: win.cursor,
    end: Math.max(win.end, win.cursor),
    savedAt: win.cursor,
    directives: win.directives || null,
    state
  };
}

export function resumeSnapshot(snap) {
  return {
    systemId: snap.systemId,
    start: snap.start,
    cursor: snap.savedAt,
    end: Math.max(snap.end, snap.savedAt),
    directives: snap.directives || null,
    state: snap.state
  };
}

/* Standing orders for a dormant society. The cursor does not move. */
export function setDirectives(win, directives) {
  return {
    ...win,
    directives: { ...(win.directives || {}), ...directives },
    start: win.start,
    cursor: win.cursor,
    end: win.end
  };
}

export function overlap(a, b) {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (end <= start) return null;
  return { start, end };
}

export function arrivalTime(tEmit, distanceLy, v = C_LY_PER_YEAR) {
  if (!(v > 0)) throw new Error('Speed must be positive.');
  return tEmit + distanceLy / v;
}

export function validateEmission(emission, sender) {
  if (emission.t > sender.cursor + 1e-9) return { ok: false, reason: 'An emission cannot be stamped ahead of the sender cursor.' };
  return { ok: true };
}

/* Detection at t_a. A GW scramble near t_a blinds that channel. */
export function scrambled(channel, tArrive, seed = GALAXY_SEED) {
  if (channel !== 'gw') return false;
  return pinsUpTo(tArrive + 1, seed).some((ev) => ev.kind === 'gw-scramble' && Math.abs(ev.t - tArrive) < 1000);
}

export function canDetect(comms, channel, tArrive, seed) {
  return !!(comms && comms[channel]) && !scrambled(channel, tArrive, seed);
}

/*
  Resolve one emission against one receiver window.
  status:
    pending        t_a is still ahead of the cursor, inside the window
    deliver        the cursor has reached t_a on this advance (not a rewrite)
    archive-echo   t_a is in the already-played span; the past is not rewritten
    permanent-echo t_a is outside the window; a later society may find it
    missed         same, when no later listener is implied
    blinded        the channel is scrambled at t_a
    silent         the receiver lacks the tech
*/
/*
  Where t_a sits:
    before start                         permanent echo
    after a closed end, or after an end
    that already lies ahead of the cursor permanent echo
    ahead of the cursor, window still
    open (end == cursor is the frontier) pending, including while offline
    behind the cursor, inside the window archive echo, past is not rewritten
    exactly on the cursor                deliver
*/
export function resolveEmission(emission, receiver, seed = GALAXY_SEED) {
  const ta = arrivalTime(emission.t, emission.distanceLy, emission.v || C_LY_PER_YEAR);
  const base = { ta, id: emission.id, channel: emission.channel, rewrite: false };
  if (ta < receiver.start) return { ...base, status: 'permanent-echo' };
  const bounded = receiver.closed || receiver.end > receiver.cursor;
  if (ta > receiver.end && bounded) return { ...base, status: 'permanent-echo' };
  if (scrambled(emission.channel, ta, seed)) return { ...base, status: 'blinded' };
  if (!canDetect(receiver.comms, emission.channel, ta, seed)) return { ...base, status: 'silent' };
  if (ta > receiver.cursor) return { ...base, status: 'pending' };
  if (ta < receiver.cursor) return { ...base, status: 'archive-echo' };
  return { ...base, status: 'deliver' };
}

/* Move the cursor forward and collect what becomes deliverable on the way. */
export function advanceAndDeliver(receiver, emissions, years, seed = GALAXY_SEED) {
  const before = receiver.cursor;
  const next = advanceCursor(receiver, years);
  const delivered = [];
  const echoes = [];
  const pending = [];
  emissions.forEach((emission) => {
    const at = resolveEmission(emission, { ...next, cursor: next.cursor }, seed);
    const ta = at.ta;
    if (ta > before && ta <= next.cursor && at.status === 'deliver') {
      delivered.push({ ...at, status: 'deliver' });
      return;
    }
    if (ta > before && ta <= next.cursor && (at.status === 'silent' || at.status === 'blinded')) {
      echoes.push({ ...at, status: 'archive-echo', note: 'Arrived while the cursor passed, and was not heard.' });
      return;
    }
    const now = resolveEmission(emission, next, seed);
    if (now.status === 'pending') pending.push(now);
    else if (now.status === 'archive-echo') echoes.push(now);
    else if (now.status === 'deliver') delivered.push(now);
  });
  return { window: next, delivered, echoes, pending };
}

/* Deep evolution. Same inputs, same result, including for an offline system. */
export function evolveSystem(system, t, seed = GALAXY_SEED) {
  const age = t - system.formedAt;
  const pins = pinsUpTo(t, seed).map((ev) => ev.id);
  const log = (system.log || []).filter((ev) => ev.t <= t).map((ev) => ev.id).sort();
  let stage = 'cooling';
  if (age > 1e6) stage = 'microbial';
  if (age > 2e8) stage = 'complex';
  if (system.hazard > 0.8 && age > 1e6) stage = 'subsurface';
  if (age >= system.techAfter) stage = 'technological';
  const hash = [system.seed, system.design, stage, pins.join('.'), log.join('.')].join('|');
  return { stage, age, pins, log, hash };
}

export function mergeEvents(rows) {
  const map = new Map();
  rows.forEach((row) => { if (row && row.id) map.set(row.id, row); });
  return [...map.values()].sort((a, b) => (a.t - b.t) || String(a.systemId).localeCompare(String(b.systemId)) || String(a.id).localeCompare(String(b.id)));
}

/* Zoom: tens of thousands of years are a short span. 50,000 years is the default lens. */
export const ZOOM_YEARS = 50000;
export function zoomFactor(galacticSpan = 1e9) {
  return galacticSpan / ZOOM_YEARS;
}

/* A fine clock inside the lens. fraction is 0..1 across the zoom span. */
export function localClock(fraction, span = ZOOM_YEARS) {
  const u = Math.max(0, Math.min(1, fraction || 0));
  return u * span;
}

/* The star has to exist, and the stage is exactly what deep evolution allows. */
export function entryVerdict(system, t, seed = GALAXY_SEED) {
  if (!(t >= system.formedAt)) return { ok: false, reason: 'The star does not exist yet.' };
  const life = system.lifetime == null ? Infinity : system.lifetime;
  if (!(t < system.formedAt + life)) return { ok: false, reason: 'The star has already died.' };
  const evolution = evolveSystem(system, t, seed);
  return { ok: true, stage: evolution.stage, evolution };
}

export function openWindow(system, t, systemId, seed = GALAXY_SEED) {
  const verdict = entryVerdict(system, t, seed);
  if (!verdict.ok) throw new Error(verdict.reason);
  return { window: createWindow({ systemId, start: t, cursor: t }), stage: verdict.stage, evolution: verdict.evolution };
}

export function hashString(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Deterministic detection roll in [0, 1). Two clients share the same roll. */
export function detectionRoll(seed, emissionId, systemId) {
  return mulberry32(hashString([seed, emissionId, systemId].join('|')))();
}

export function detectionChance(emission) {
  if (emission.strength != null) return Math.max(0, Math.min(1, emission.strength));
  const dist = Math.max(0.01, emission.distanceLy || 1);
  let chance = 1 / (1 + dist / 40);
  if (emission.silent) chance *= 0.35;
  return Math.max(0.02, Math.min(0.97, chance));
}

/* An arrival already inside the played span. The past is not rewritten. */
export function surfaceEcho(emission, receiver, seed = GALAXY_SEED) {
  const at = resolveEmission(emission, receiver, seed);
  if (at.status !== 'archive-echo') return null;
  const chance = detectionChance(emission);
  const roll = detectionRoll(seed, emission.id, receiver.systemId);
  const heard = roll < chance;
  return {
    ...at,
    rewrite: false,
    chance,
    roll,
    heard,
    payoff: heard ? 'archive-discovery' : 'none',
    note: heard
      ? 'A signal arrived unnoticed. The archives kept it, and the past was not rewritten.'
      : 'A faint mark in the archives. The detection check did not clear it.'
  };
}

/* Logout cursor, then the next session. The cursor stays. Echoes are discoveries. */
export function nextSession(snap, emissions, seed = GALAXY_SEED) {
  const window = resumeSnapshot(snap);
  const receiver = {
    ...window,
    comms: (snap.state && snap.state.comms) || snap.comms || {},
    directives: window.directives
  };
  const echoes = [];
  const pending = [];
  emissions.forEach((emission) => {
    const at = resolveEmission(emission, receiver, seed);
    if (at.status === 'archive-echo') {
      const echo = surfaceEcho(emission, receiver, seed);
      if (echo) echoes.push(echo);
    } else if (at.status === 'pending') pending.push(at);
  });
  return { window, echoes, pending, cursor: window.cursor };
}

/* A signal that missed a window can be found later by someone near that region. */
export function discoverPermanent(emission, missedBy, visitor) {
  const ta = arrivalTime(emission.t, emission.distanceLy, emission.v || C_LY_PER_YEAR);
  const before = ta < missedBy.start;
  const after = ta > missedBy.end && (missedBy.closed || missedBy.end > missedBy.cursor);
  if (!before && !after) return { status: 'not-an-echo', ta, rewrite: false };
  const near = visitor.region == null || missedBy.region == null || visitor.region === missedBy.region;
  const covered = ta >= visitor.start && ta <= visitor.end;
  if (!near || !covered) return { status: 'missed', ta, rewrite: false };
  return { status: 'discovered-echo', ta, rewrite: false, payoff: 'archive-discovery' };
}

/* A reply is a new emission from the replier's own cursor. */
export function replyTo(original, replier, distanceLy, channel, v = C_LY_PER_YEAR) {
  const emission = {
    id: 'reply-' + original.id + '-' + replier.systemId,
    t: replier.cursor,
    distanceLy,
    channel: channel || original.channel,
    systemId: replier.systemId,
    v,
    inReplyTo: original.id
  };
  const check = validateEmission(emission, replier);
  if (!check.ok) throw new Error(check.reason);
  return emission;
}

export function lightCone(emission, tNow) {
  const v = emission.v || C_LY_PER_YEAR;
  const ta = arrivalTime(emission.t, emission.distanceLy, v);
  const inFlight = tNow >= emission.t && tNow < ta;
  const traveled = Math.max(0, Math.min(emission.distanceLy, (tNow - emission.t) * v));
  return {
    tEmit: emission.t,
    tArrive: ta,
    inFlight,
    traveledLy: traveled,
    remainingLy: Math.max(0, emission.distanceLy - traveled)
  };
}

export function inFlightSignals(emissions, tNow) {
  return emissions
    .map((emission) => ({ id: emission.id, cone: lightCone(emission, tNow) }))
    .filter((row) => row.cone.inFlight);
}

export function checkpointKey(system, t, seed = GALAXY_SEED) {
  return [seed, system.seed, system.design, t].join(':');
}

export function evolveCached(system, t, seed = GALAXY_SEED, cache = new Map()) {
  const key = checkpointKey(system, t, seed);
  if (cache.has(key)) return cache.get(key);
  const result = evolveSystem(system, t, seed);
  cache.set(key, result);
  return result;
}

export function validateLogged(event, sender) {
  if (!event || !event.id) return { ok: false, reason: 'An event needs an id.' };
  if (event.kind === 'emission' || event.channel) {
    return validateEmission(event, sender || { cursor: event.t });
  }
  if (event.kind === 'window' && event.before && event.after) {
    const ok = validateGrowth(event.before, event.after);
    return { ok, reason: ok ? '' : 'Windows only grow forward from the cursor.' };
  }
  return { ok: true };
}
