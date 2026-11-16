import {
  pinnedEvent, pinsUpTo, createWindow, advanceCursor, validateGrowth,
  logoutSnapshot, resumeSnapshot, overlap, arrivalTime, validateEmission,
  resolveEmission, advanceAndDeliver, evolveSystem, mergeEvents, zoomFactor,
  setDirectives, entryVerdict, openWindow, surfaceEcho, nextSession,
  discoverPermanent, replyTo, lightCone, inFlightSignals, evolveCached,
  validateLogged, localClock, detectionChance, GALAXY_SEED
} from '../js/engine/timeline.js';

let fails = 0;
const check = (ok, msg, extra) => {
  if (!ok) fails++;
  console.log(ok ? '  PASS' : '  FAIL', msg, extra === undefined ? '' : JSON.stringify(extra));
};

const A = createWindow({ systemId: 'alpha', start: 2.0e9, cursor: 2.0e9 });
const B = createWindow({ systemId: 'beta', start: 2.1e9, cursor: 2.12e9, end: 2.12e9 });
const over = overlap(advanceCursor(A, 0.2e9), B);
check(over && over.start === 2.1e9 && over.end === 2.12e9, 'windows that share years overlap on that span', over);

const ta = arrivalTime(2.0e9, 42, 1);
check(ta === 2.0e9 + 42, 'light arrives after d/c years', ta);
const ship = arrivalTime(2.0e9, 10, 0.1);
check(Math.abs(ship - (2.0e9 + 100)) < 1e-6, 'a slower vessel arrives later than light', ship);

const receiver = createWindow({ systemId: 'beta', start: 2.0e9, cursor: 2.0e9, end: 2.0e9 + 500 });
const emission = { id: 'em-1', t: 2.0e9, distanceLy: 100, channel: 'gw', systemId: 'alpha', v: 1 };
check(validateEmission(emission, { cursor: 2.0e9 }).ok, 'a stamp at the cursor is legal');
check(!validateEmission({ ...emission, t: 2.0e9 + 10 }, { cursor: 2.0e9 }).ok, 'a stamp ahead of the cursor is rejected');

const pending = resolveEmission(emission, { ...receiver, comms: { gw: true } });
check(pending.status === 'pending' && pending.ta === 2.0e9 + 100, 'arrival ahead of the cursor waits', pending);

const played = advanceAndDeliver({ ...receiver, comms: { gw: true } }, [emission], 100);
check(played.delivered.length === 1 && played.delivered[0].status === 'deliver', 'advancing the cursor to t_a delivers the signal');
check(played.delivered[0].rewrite === false, 'delivery does not claim to rewrite the past');

const late = resolveEmission(emission, { ...receiver, cursor: 2.0e9 + 200, end: 2.0e9 + 200, comms: { gw: true } });
check(late.status === 'archive-echo' && late.rewrite === false, 'an arrival in the already-played span is an echo, not a rewrite', late.status);

const outside = resolveEmission(emission, { systemId: 'beta', start: 2.0e9 + 1000, cursor: 2.0e9 + 1000, end: 2.0e9 + 1000, comms: { gw: true } });
check(outside.status === 'permanent-echo', 'an arrival outside the window is a permanent echo');

const spec = { seed: 7, design: 'bh-home', formedAt: 1e7, hazard: 0.96, techAfter: 5e6, log: [{ id: 'x', t: 2e7 }] };
const left = evolveSystem(spec, 3e7, GALAXY_SEED);
const right = evolveSystem(spec, 3e7, GALAXY_SEED);
check(left.hash === right.hash && left.stage === right.stage, 'two clients at the same ruler position compute the same system', left.hash);

const interleaved = mergeEvents([
  { id: 'b', t: 5, systemId: 'z' },
  { id: 'a', t: 5, systemId: 'a' },
  { id: 'c', t: 4, systemId: 'm' },
  { id: 'b', t: 9, systemId: 'z' }
]);
check(interleaved.map((e) => e.id).join(',') === 'c,a,b', 'interleaved writes merge by t, then system, then id', interleaved.map((e) => e.id));

const grown = advanceCursor(A, 1000);
check(validateGrowth(A, grown) && !validateGrowth(grown, A), 'windows only grow forward');

const snap = logoutSnapshot(grown, { pop: 40, stage: left.stage });
const back = resumeSnapshot(snap);
check(back.cursor === grown.cursor && back.state.pop === 40, 'logout stores the cursor and the state, and resume does not move it', back.cursor);
check(resumeSnapshot(snap).cursor === snap.savedAt, 'a second client loading the snapshot is still at the logout cursor');

check(zoomFactor(1e9) === 20000, 'a billion-year stretch over a 50,000-year lens is a zoom of 20,000');
check(localClock(0.5, 50000) === 25000, 'the time lens has a fine local clock');
const pin = pinnedEvent(3);
check(pin.t === pinnedEvent(3).t && pin.kind === pinnedEvent(3).kind, 'pins do not depend on the wall clock');
check(pinsUpTo(pin.t).some((ev) => ev.id === pin.id), 'a pin is visible at its own ruler position');

const dormant = setDirectives(grown, { broadcast: false, research: true });
check(dormant.cursor === grown.cursor && dormant.end === grown.end && dormant.directives.broadcast === false, 'standing directives do not advance the cursor');

const star = { seed: 7, design: 'bh-home', formedAt: 1e7, lifetime: 5e7, hazard: 0.96, techAfter: 2e7, log: [] };
check(!entryVerdict(star, 1e6).ok, 'an entry before the star exists is refused');
check(!entryVerdict(star, 1e7 + 5e7).ok, 'an entry after the star dies is refused');
const opened = openWindow(star, 1.2e7, 'home-system');
check(opened.stage === 'subsurface' && opened.window.cursor === 1.2e7, 'entry takes the stage deep evolution allows, and no more', opened.stage);

const offline = createWindow({ systemId: 'beta', start: 2e9, cursor: 2e9 });
const later = { id: 'em-later', t: 2e9, distanceLy: 40, channel: 'radio', systemId: 'alpha' };
const waiting = resolveEmission(later, { ...offline, comms: { radio: true } });
check(waiting.status === 'pending', 'a signal after an offline cursor waits as pending', waiting.status);
const saved = logoutSnapshot(offline, { pop: 40, comms: { radio: true } });
const session = nextSession(saved, [later]);
check(session.cursor === offline.cursor && session.pending.length === 1 && session.echoes.length === 0, 'resume stays on the logout cursor and keeps the signal pending');
const caughtUp = advanceAndDeliver({ ...resumeSnapshot(saved), comms: { radio: true } }, [later], 40);
check(caughtUp.delivered.length === 1 && caughtUp.window.cursor === offline.cursor + 40, 'advancing from the logout cursor delivers the waiting signal');

const heard = surfaceEcho(
  { id: 'loud', t: 2e9, distanceLy: 10, channel: 'radio', strength: 1, systemId: 'alpha' },
  { ...offline, cursor: 2e9 + 80, end: 2e9 + 80, comms: { radio: true } }
);
const missed = surfaceEcho(
  { id: 'faint', t: 2e9, distanceLy: 10, channel: 'radio', strength: 0, systemId: 'alpha' },
  { ...offline, cursor: 2e9 + 80, end: 2e9 + 80, comms: { radio: true } }
);
check(heard && heard.heard && heard.payoff === 'archive-discovery' && heard.rewrite === false, 'an archive echo can pay off without rewriting the past');
check(missed && !missed.heard && missed.payoff === 'none' && missed.rewrite === false, 'a failed detection check yields no payoff and no rewrite');

const openBeacon = detectionChance({ id: 'b', distanceLy: 40, silent: false });
const quietBeacon = detectionChance({ id: 'b', distanceLy: 40, silent: true });
check(quietBeacon < openBeacon, 'silence, as speculation, makes a beacon harder to notice', { openBeacon, quietBeacon });

const closed = { systemId: 'gone', start: 1e9, cursor: 1.2e9, end: 1.2e9, closed: true, region: 'harbor', comms: { radio: true } };
const echo = { id: 'old', t: 1.2e9, distanceLy: 30, channel: 'radio', systemId: 'gone' };
const visitor = { systemId: 'later', start: 1.2e9, cursor: 1.2e9 + 30, end: 1.2e9 + 30, region: 'harbor' };
const found = discoverPermanent(echo, closed, visitor);
check(found.status === 'discovered-echo' && found.rewrite === false, 'a later neighbor can find a permanent echo');
const far = discoverPermanent(echo, closed, { ...visitor, region: 'elsewhere' });
check(far.status === 'missed', 'a permanent echo is missed when the listener is not near that region');

const answer = replyTo(later, { systemId: 'beta', cursor: 2e9 + 40 }, 40, 'radio');
check(answer.t === 2e9 + 40 && validateEmission(answer, { cursor: 2e9 + 40 }).ok, 'a reply is stamped at the replier cursor');
check(arrivalTime(answer.t, answer.distanceLy) === 2e9 + 80, 'the reply arrives after another d/c');

const cone = lightCone({ id: 'fly', t: 100, distanceLy: 10, v: 1 }, 104);
check(cone.inFlight && cone.traveledLy === 4 && cone.tArrive === 110, 'an in-flight signal is a light-cone segment', cone);
check(inFlightSignals([{ id: 'fly', t: 100, distanceLy: 10 }], 104).length === 1, 'the ruler can list in-flight wedges');
check(inFlightSignals([{ id: 'fly', t: 100, distanceLy: 10 }], 110).length === 0, 'a signal that has arrived is no longer in flight');

const cache = new Map();
const first = evolveCached(star, 1.5e7, GALAXY_SEED, cache);
const second = evolveCached(star, 1.5e7, GALAXY_SEED, cache);
check(first === second && first.hash === evolveSystem(star, 1.5e7).hash, 'a checkpoint returns the same evolution, and matches a fresh evaluation');

const bad = validateLogged({ id: 'too-soon', kind: 'emission', t: 50, channel: 'radio' }, { cursor: 10 });
const shrink = validateLogged({ id: 'shrink', kind: 'window', before: grown, after: A });
check(!bad.ok && !shrink.ok, 'the log rejects an early emission and a window that shrinks');

console.log(fails ? `\n${fails} FAILED` : '\ntimeline checks passed');
process.exit(fails ? 1 : 0);
