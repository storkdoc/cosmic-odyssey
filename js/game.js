/* Campaign state for Cosmic Odyssey. No DOM. Flight is Newtonian; the Forge,
   the rescue, the lab and the backer perks live on the same save. */
import {
  SYSTEMS, getSystem, DRIVES, TECH, TIPS, beaconStrength, NAMES, THREATS, FEATURED
} from './data.js';
import {
  AU, starGM, planetRadius, kepler, meanMotion, stepShip, shipMass,
  approach, climate, lookFromClimate, deltaV, planetGM
} from './sim.js';

const SAVE = 'cosmic-odyssey.save';
const MAYDAY = 480;

function freshShip() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, heading: 0,
    fuel: 0.85, xe: 0.35,
    cargo: { ice: 0, iron: 0, si: 0, carbon: 0, xe: 0 },
    drive: 'chem',
    throttle: 0,
    hull: 1
  };
}

function fresh() {
  return {
    v: 1,
    systemId: 'proxima',
    t: 18,
    ship: freshShip(),
    docked: true,
    landed: null,
    surface: null,
    tech: {
      chem: true, sail: false, ion: false, shield: false, nano: false,
      ramjet: false, dark: false, ctime: false, opto: false, singularity: false
    },
    research: 0,
    surveyed: {},
    surveyPaid: {},
    mined: { ice: 0, iron: 0, si: 0, carbon: 0, xe: 0 },
    landedOnce: {},
    rescued: false,
    mayday: null,
    maydayLost: false,
    sideClock: null,
    overrides: {},
    life: {},
    bestLife: 0,
    nurture: null,
    miner: false,
    warp: 1,
    target: 0,
    sailOn: false,
    shieldOn: false,
    cinematic: null,
    line: 'Infinity Command. LYRA is on the link. The charts are loaded, and the tanks are full.',
    lineT: 9,
    slingArm: null,
    hullFlash: 0,
    drone: { x: 0, y: 0 },
    rescueHold: 0,
    stick: { x: 0, y: 0 },
    jet: 0,
    eva: { x: 0, y: 0, fuel: 1 },
    seen: {},
    coins: NAMES.coins,
    backer: true,
    founder: true,
    suit: { skin: 'coalition', primary: '#d5dee6', accent: '#e25b1a' },
    shipDesign: { name: NAMES.ship, hull: 'ring', primary: '#c5d0d8', accent: '#e25b1a' },
    robots: { drone: true, miner: false, sat: false },
    threat: null,
    surfaceTime: 0,
    universes: [],
    actualized: { 'glass-meridian': true },
    logged: {},
    goals: {},
    oneill: { visited: false, settled: 0 },
    matching: false,
    author: NAMES.founder
  };
}

function naturalClimate(planet, star) {
  const S = star.L / (planet.aAU * planet.aAU);
  let atmosphere = planet.atmosphere || 'co2';
  let pressure = planet.pressure != null ? planet.pressure : 0.7;
  let greenhouse = planet.greenhouse != null ? planet.greenhouse : 0.75;
  let water = planet.water != null ? planet.water : 0.25;
  let albedo = planet.albedo != null ? planet.albedo : 0.32;
  if (planet.atmosphere == null) {
    if (S > 2.2) { pressure = 6; greenhouse = 1.45; water = 0.04; albedo = 0.55; }
    else if (S > 1.25) { pressure = 1.4; greenhouse = 1.15; water = 0.08; albedo = 0.4; }
    else if (S < 0.35) {
      pressure = 0.25; greenhouse = 0.45;
      water = planet.ores && planet.ores.ice > 0.4 ? 0.55 : 0.12;
      albedo = 0.5;
    } else { water = 0.2 + ((planet.ores && planet.ores.ice) || 0.2) * 0.45; }
    if (planet.ores && planet.ores.ice > 0.5) { albedo = 0.58; greenhouse = 0.4; water = 0.72; }
  }
  return { L: star.L, aAU: planet.aAU, albedo, pressure, greenhouse, water, atmosphere };
}

function hydrate(raw) {
  const star = raw.star || { mass: 1, L: 1, teff: 5600, spectral: 'G', radius: 1 };
  const gm = starGM(star.mass);
  const planets = (raw.planets || []).map((p, i) => {
    const mass = p.mass || 1;
    const radius = p.radius || Math.pow(mass, 0.27);
    const aAU = p.aAU || 1;
    return {
      id: p.id || (raw.id + '-' + (i + 1)),
      name: p.name || ('World ' + (i + 1)),
      aAU, a: aAU, mass, radius,
      e: p.e || 0.01,
      M0: p.M0 || i,
      rock: 1,
      moon: !!p.moon,
      atmosphere: p.atmosphere,
      pressure: p.pressure,
      water: p.water,
      albedo: p.albedo,
      greenhouse: p.greenhouse,
      ores: p.ores || { iron: 0.3, si: 0.24, ice: Math.min(0.6, (p.water || 0.2) + 0.1), carbon: 0.12, xe: 0.06 },
      note: p.note || (p.name + '. A world from a made chart.'),
      life0: p.life || 0,
      gmStar: gm,
      well: planetGM(mass)
    };
  });
  return {
    id: raw.id,
    name: raw.name,
    author: raw.author || '',
    about: raw.about || '',
    challenge: raw.challenge || '',
    goal: raw.goal || null,
    gate: raw.gate || null,
    blurb: raw.about || raw.blurb || raw.name,
    star, planets,
    flare: raw.flare || 0,
    nebula: raw.nebula || [0.22, 0.2, 0.3],
    actualized: !!raw.actualized,
    featured: !!raw.author,
    clock: raw.goal && raw.goal.clock ? raw.goal.clock : 0
  };
}

export function createGame(saved) {
  const g = fresh();
  if (saved && saved.v === 1 && saved.ship) {
    const ship = { ...freshShip(), ...saved.ship, cargo: { ...freshShip().cargo, ...(saved.ship.cargo || {}) } };
    Object.assign(g, saved, {
      ship,
      cinematic: null,
      lineT: 0,
      drone: { x: 0, y: 0 },
      stick: { x: 0, y: 0 },
      matching: false,
      jet: 0
    });
    g.tech = { ...fresh().tech, ...(saved.tech || {}) };
    g.robots = { ...fresh().robots, ...(saved.robots || {}) };
    g.suit = { ...fresh().suit, ...(saved.suit || {}) };
    g.shipDesign = { ...fresh().shipDesign, ...(saved.shipDesign || {}) };
    g.oneill = { ...fresh().oneill, ...(saved.oneill || {}) };
    g.eva = { ...fresh().eva, ...(saved.eva || {}) };
    g.actualized = { ...fresh().actualized, ...(saved.actualized || {}) };
    g.logged = saved.logged || {};
    g.goals = saved.goals || {};
    g.universes = Array.isArray(saved.universes) ? saved.universes : [];
    if (saved.backer == null) g.backer = true;
  }

  function catalog() {
    return SYSTEMS.concat(FEATURED.map(hydrate)).concat((g.universes || []).map(hydrate));
  }

  function sys() {
    return catalog().find((s) => s.id === g.systemId) || SYSTEMS[0];
  }

  function findPlanet(id) {
    for (const s of catalog()) {
      const p = s.planets.find((q) => q.id === id);
      if (p) return { system: s, planet: p };
    }
    return null;
  }

  function bodies() {
    const s = sys();
    const gm = starGM(s.star.mass);
    const list = [{
      id: 'star', kind: 'star', name: s.name,
      x: 0, y: 0, vx: 0, vy: 0, gm, soft: 0.42,
      radius: s.star.mass > 0.8 ? 0.85 : 0.48,
      teff: s.star.teff, L: s.star.L, spectral: s.star.spectral
    }];
    for (const p of s.planets) {
      const a = p.aAU * AU;
      const st = kepler(a, p.e || 0, (p.M0 || 0) + meanMotion(a, gm) * g.t, gm);
      const radius = planetRadius(p.radius);
      list.push({
        ...p, kind: 'planet', a, radius,
        x: st.x, y: st.y, vx: st.vx, vy: st.vy,
        gm: p.well, soft: Math.max(0.02, radius * 0.72)
      });
    }
    return list;
  }

  function station(list) {
    const listUse = list || bodies();
    const p = listUse.find((b) => b.id === 'proxima-b');
    if (!p || g.systemId !== 'proxima') return null;
    const r = p.radius * 5.6;
    const w = Math.sqrt(p.gm / (r * r * r));
    const ang = g.t * w + 0.4;
    return {
      x: p.x + Math.cos(ang) * r,
      y: p.y + Math.sin(ang) * r,
      vx: p.vx - Math.sin(ang) * w * r,
      vy: p.vy + Math.cos(ang) * w * r,
      radius: 0.16
    };
  }

  function targetBody(list) {
    const listUse = list || bodies();
    const planets = listUse.filter((b) => b.kind === 'planet');
    if (!planets.length) return listUse[0];
    g.target = ((g.target % planets.length) + planets.length) % planets.length;
    return planets[g.target];
  }

  function say(text, sec) {
    g.line = text;
    g.lineT = sec || 7.5;
  }

  function lockedChem(id) {
    const found = findPlanet(id);
    if (!found) return false;
    return !!(g.actualized[found.system.id] || found.system.actualized);
  }

  function climateFor(id) {
    const found = findPlanet(id);
    if (!found) return climate({ L: 1, aAU: 1, albedo: 0.3, pressure: 1, greenhouse: 1, water: 0.7, atmosphere: 'n2o2' });
    const base = naturalClimate(found.planet, found.system.star);
    const over = g.overrides[id] || {};
    const spec = { ...base, ...over, L: found.system.star.L, aAU: found.planet.aAU };
    if (found.planet.life0 && g.life[id] == null) g.life[id] = found.planet.life0;
    return climate(spec);
  }

  function look(id) {
    return lookFromClimate(climateFor(id), g.life[id] || 0);
  }

  function thrustAccel(h) {
    const d = DRIVES[g.ship.drive] || DRIVES.chem;
    const mass = shipMass(g.ship);
    let ax = 0;
    let ay = 0;
    const th = g.ship.throttle || 0;
    if (Math.abs(th) > 0.01 && d.fuel !== 'none' && g.ship.drive !== 'sail') {
      const tank = d.fuel === 'xe' ? g.ship.xe : g.ship.fuel;
      if (tank > 0.0008) {
        const acc = (d.thrust * Math.abs(th)) / mass;
        const dir = g.ship.heading + (th < 0 ? Math.PI : 0);
        ax += Math.cos(dir) * acc;
        ay += Math.sin(dir) * acc;
        const mdot = (d.thrust * Math.abs(th)) / d.ve * h;
        if (d.fuel === 'xe') g.ship.xe = Math.max(0, g.ship.xe - mdot);
        else g.ship.fuel = Math.max(0, g.ship.fuel - mdot);
      }
    }
    if ((g.sailOn || g.ship.drive === 'sail') && g.tech.sail) {
      const r = Math.hypot(g.ship.x, g.ship.y) || 0.2;
      const push = sys().star.L * 2.4 / (r * r);
      ax += (g.ship.x / r) * push;
      ay += (g.ship.y / r) * push;
    }
    if (g.tech.ramjet && g.ship.drive === 'ramjet') {
      const sp = Math.hypot(g.ship.vx, g.ship.vy);
      if (sp > 0.55) g.ship.fuel = Math.min(1.5, g.ship.fuel + 0.012 * h);
    }
    if (g.tech.dark && !g.docked && !g.landed) g.research += 0.015 * h;
    return [ax, ay];
  }

  function placeInSystem(id) {
    g.systemId = id;
    g.docked = false;
    g.landed = null;
    g.surface = null;
    g.t = 5;
    g.threat = null;
    const s = sys();
    if (id === 'proxima') {
      const list = bodies();
      const st = station(list);
      const home = list.find((b) => b.id === 'proxima-b');
      g.ship.x = st.x;
      g.ship.y = st.y;
      g.ship.vx = st.vx;
      g.ship.vy = st.vy;
      g.ship.heading = Math.atan2(st.y - home.y, st.x - home.x);
      g.docked = true;
      say('Infinity Command has you. The Flight Deck and the Forge are open.');
      return;
    }
    const list = bodies();
    const outer = list.filter((b) => b.kind === 'planet').slice(-1)[0];
    const r = outer ? outer.a * 1.28 : 8;
    const gm = list[0].gm;
    const v = Math.sqrt(gm / r);
    g.ship.x = r;
    g.ship.y = 0.2;
    g.ship.vx = 0;
    g.ship.vy = v * 0.92;
    g.ship.heading = Math.PI / 2;
    g.target = 0;
    if (id === 'trappist' && !g.rescued) {
      g.mayday = MAYDAY;
      g.maydayLost = false;
      say('TRAPPIST-1. Seven worlds, one distress call. Scan them. The cells will not wait.');
    } else if (s.clock && !g.goals[s.id]) {
      g.sideClock = s.clock;
      say(s.challenge || s.blurb);
    } else {
      g.sideClock = null;
      say(TIPS[id] || s.blurb || s.name);
    }
  }

  function finishCinematic() {
    const c = g.cinematic;
    if (!c) return;
    if (c.kind === 'entry') {
      const list = bodies();
      const p = list.find((b) => b.id === c.planetId);
      if (p) {
        g.ship.vx = p.vx;
        g.ship.vy = p.vy;
        g.ship.x = p.x + p.radius * 1.02;
        g.ship.y = p.y;
        g.landed = p.id;
        g.landedOnce[p.id] = true;
        g.miner = false;
        g.surfaceTime = 0;
        g.eva = { x: 0, y: 0, fuel: 1 };
        g.research += 4;
        const rescueHere = g.mayday != null && p.id === 'trappist-e' && !g.rescued;
        if (rescueHere) {
          const ang = Math.random() * Math.PI * 2;
          const rad = 18 + Math.random() * 14;
          g.surface = {
            kind: 'rescue',
            x: Math.cos(ang + Math.PI) * 8,
            y: Math.sin(ang + Math.PI) * 8,
            wreckX: Math.cos(ang) * rad,
            wreckY: Math.sin(ang) * rad,
            progress: 0
          };
          say('The beacon is on the surface. Fly the survey drone. The cells are still counting.');
        } else {
          g.surface = { kind: 'field' };
          say(p.note || 'Down. The lab can read this air.');
        }
        noteGoal();
      }
    } else if (c.kind === 'depart') {
      placeInSystem(c.to);
    }
    g.cinematic = null;
  }

  function bounce(p, ap) {
    const nx = ap.nx;
    const ny = ap.ny;
    g.ship.x = p.x + nx * (p.radius * 1.05);
    g.ship.y = p.y + ny * (p.radius * 1.05);
    const rvx = g.ship.vx - p.vx;
    const rvy = g.ship.vy - p.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      g.ship.vx -= 1.45 * vn * nx;
      g.ship.vy -= 1.45 * vn * ny;
    }
    g.ship.fuel = Math.max(0, g.ship.fuel - 0.015);
    g.hullFlash = 1;
  }

  function applyMatch(dt) {
    if (!g.matching || g.docked || g.landed) return;
    const list = bodies();
    const focus = targetBody(list);
    const cx = focus.x;
    const cy = focus.y;
    const dx = g.ship.x - cx;
    const dy = g.ship.y - cy;
    const r = Math.hypot(dx, dy) || 1;
    const speed = Math.sqrt(focus.gm / r);
    const tx = -dy / r * speed + (focus.vx || 0);
    const ty = dx / r * speed + (focus.vy || 0);
    const bx = tx - g.ship.vx;
    const by = ty - g.ship.vy;
    if (Math.hypot(bx, by) < 0.03) {
      g.ship.throttle = 0;
      g.matching = false;
      say('Matched. A circular path around ' + focus.name + '.');
      return;
    }
    g.ship.heading = Math.atan2(by, bx);
    g.ship.throttle = 1;
    if (dt > 2) g.matching = false;
  }

  function step(realDt) {
    const dt = Math.max(0, Math.min(0.05, realDt || 0));
    if (g.lineT > 0) g.lineT -= dt;
    if (g.hullFlash > 0) g.hullFlash -= dt;
    if (g.cinematic) {
      g.cinematic.t += dt;
      if (g.cinematic.kind === 'launch' && g.cinematic.t < 2.6) g.ship.throttle = 1;
      if (g.cinematic.t >= g.cinematic.dur) finishCinematic();
    }
    if (g.mayday != null && !g.docked && !g.cinematic && !g.rescued) {
      g.mayday -= dt;
      if (g.mayday <= 0) {
        g.mayday = null;
        g.maydayLost = true;
        say('The cells went quiet. A relay from Infinity Command can bring the beacon back.');
      }
    }
    if (g.sideClock != null && !g.docked && !g.cinematic) {
      g.sideClock -= dt;
      if (g.sideClock <= 0) {
        g.sideClock = null;
        say('The lantern clock ran out. Plot the course again and the chart resets.');
      }
    }
    if (g.cinematic && (g.cinematic.kind === 'depart' || g.cinematic.kind === 'entry')) return;
    if (g.docked) {
      g.t += dt;
      g.ship.throttle = 0;
      return;
    }
    if (g.landed) {
      g.t += dt;
      stepSurface(dt);
      return;
    }
    applyMatch(dt);
    let scale = g.warp;
    if (g.cinematic || Math.abs(g.ship.throttle) > 0.04 || g.matching) scale = 1;
    if (!g.tech.ctime) scale = Math.min(scale, 40);
    const list0 = bodies();
    const near = list0.some((b) => b.kind === 'planet' && Math.hypot(g.ship.x - b.x, g.ship.y - b.y) < b.radius * 10);
    if (near) scale = 1;
    const total = dt * scale;
    const h = 0.02;
    const n = Math.max(1, Math.min(70, Math.round(total / h)));
    const stepDt = total / n;
    for (let i = 0; i < n; i++) {
      g.t += stepDt;
      const list = bodies();
      const acc = thrustAccel(stepDt);
      stepShip(g.ship, list, stepDt, acc[0], acc[1]);
      for (const p of list) {
        if (p.kind !== 'planet' && p.kind !== 'star') continue;
        const ap = approach(g.ship, p);
        if (p.kind === 'star' && ap.dist < p.radius * 1.15) {
          bounce(p, ap);
          g.ship.hull = Math.max(0.2, g.ship.hull - 0.08);
          say('That is the star. Come about.');
          break;
        }
        if (p.kind === 'planet' && ap.alt < 0) {
          bounce(p, ap);
          say(ap.rel < 0.55 ? 'You are in the corridor. Call the entry burn.' : 'Too fast. RETRO sheds speed against your path, then call entry.');
          break;
        }
      }
      if (sys().flare && !g.shieldOn && !g.tech.shield) {
        const r = Math.hypot(g.ship.x, g.ship.y);
        if (r < (list[0].radius || 1) * 6) {
          g.ship.hull = Math.max(0.15, g.ship.hull - stepDt * 0.08);
          g.hullFlash = 0.4;
        }
      } else if (g.ship.hull < 1) g.ship.hull = Math.min(1, g.ship.hull + stepDt * 0.01);
    }
    watchSling();
  }

  function stepSurface(dt) {
    g.surfaceTime += dt;
    if (g.miner && g.robots.miner && g.surface && g.surface.kind === 'field' && !(g.threat && g.threat.id === 'quake' && !g.threat.handled)) {
      const found = findPlanet(g.landed);
      if (found) mine(dt * (g.tech.nano ? 1.35 : 0.85));
    }
    if (g.nurture && g.surface && g.surface.kind === 'field') {
      const n = g.nurture;
      n.heat += (0.5 - n.heat) * 0.12 * dt;
      n.wet += (0.48 - n.wet) * 0.1 * dt;
      n.light += (0.6 - n.light) * 0.16 * dt;
      const ok = n.heat > 0.32 && n.heat < 0.72 && n.wet > 0.3 && n.wet < 0.75 && n.light < 0.82;
      n.stable = Math.max(0, n.stable + (ok ? dt : -dt * 0.55));
      if (n.stable >= 16) {
        g.life[g.landed] = Math.max(g.life[g.landed] || 0, 0.9);
        g.bestLife = Math.max(g.bestLife, g.life[g.landed]);
        g.nurture = null;
        g.research += 12;
        g.coins += 8;
        say('It held. Light, water, and warmth stayed in the middle. Something is growing.');
        noteGoal();
      }
    }
    if (g.surface && g.surface.kind === 'rescue') stepRescue(dt);
    else stepEva(dt);
    if (g.surface && g.surface.kind === 'field' && (g.rescued || (g.life[g.landed] || 0) > 0)) maybeThreat(dt);
    if (g.threat && !g.threat.handled) {
      g.threat.t += dt;
      if (g.threat.t > 26) {
        g.threat.handled = true;
        g.threat.failed = true;
        g.life[g.landed] = Math.max(0, (g.life[g.landed] || 0) - 0.12);
        say('The threat ran its course. Life on the surface stepped back.');
      }
    }
  }

  function stepRescue(dt) {
    const s = g.surface;
    const dx = g.stick.x;
    const dy = g.stick.y;
    const sp = Math.hypot(dx, dy) || 1;
    const cap = 13;
    if (sp > 0.08) {
      s.x += (dx / sp) * Math.min(1, sp) * cap * dt;
      s.y += (dy / sp) * Math.min(1, sp) * cap * dt;
    }
    const dist = Math.hypot(s.x - s.wreckX, s.y - s.wreckY);
    s.dist = dist;
    if (dist < 4.5 && g.rescueHold > 0) {
      s.progress += dt;
      if (s.progress >= 1.6) {
        g.rescued = true;
        g.mayday = null;
        g.ship.cargo.xe = (g.ship.cargo.xe || 0) + 3;
        g.ship.xe += 0.8;
        g.research += 18;
        g.coins += 20;
        g.surface = { kind: 'field' };
        say('The pilot is aboard. The kit in the cutter can change an atmosphere. The cells can rest.');
      }
    } else if (g.rescueHold <= 0) s.progress = Math.max(0, (s.progress || 0) - dt);
  }

  function stepEva(dt) {
    const jetpack = !!(g.backer);
    const spd = (jetpack ? 11 : 6.5) * (g.tech.shield ? 1.15 : 1);
    const dx = g.stick.x;
    const dy = g.stick.y;
    const sp = Math.hypot(dx, dy) || 1;
    if (sp > 0.08) {
      g.eva.x += (dx / sp) * Math.min(1, sp) * spd * dt;
      g.eva.y += (dy / sp) * Math.min(1, sp) * spd * dt;
    }
    if (jetpack && g.jet > 0.2 && g.eva.fuel > 0) {
      g.eva.y += 7 * g.jet * dt;
      g.eva.fuel = Math.max(0, g.eva.fuel - 0.18 * dt);
    } else {
      g.eva.fuel = Math.min(1, g.eva.fuel + 0.12 * dt);
      g.eva.y += (0 - g.eva.y) * Math.min(1, dt * 1.4);
    }
  }

  function mine(dt) {
    const found = findPlanet(g.landed);
    if (!found || !found.planet.ores) return;
    for (const k of Object.keys(found.planet.ores)) {
      const add = found.planet.ores[k] * dt;
      g.ship.cargo[k] = (g.ship.cargo[k] || 0) + add;
      g.mined[k] = (g.mined[k] || 0) + add;
    }
    g.research += dt * 0.35;
  }

  function maybeThreat(dt) {
    if (g.threat && !g.threat.handled) return;
    if (g.surfaceTime < 18) return;
    if (g.threat && g.surfaceTime - g.threat.born < 36) return;
    if (Math.random() > dt / 24) return;
    const pick = THREATS[Math.floor(Math.random() * THREATS.length)];
    g.threat = { id: pick.id, name: pick.name, text: pick.text, t: 0, handled: false, born: g.surfaceTime };
    say(pick.name + '. ' + pick.text);
  }

  function watchSling() {
    const after = bodies();
    let closest = null;
    let closestD = 1e9;
    for (const p of after) {
      if (p.kind !== 'planet') continue;
      const d = Math.hypot(g.ship.x - p.x, g.ship.y - p.y) / Math.max(0.05, p.radius);
      if (d < closestD) { closestD = d; closest = p; }
    }
    const speed = Math.hypot(g.ship.vx, g.ship.vy);
    if (closest && closestD < 4) {
      if (!g.slingArm || g.slingArm.id !== closest.id) g.slingArm = { id: closest.id, v: speed, used: false };
    } else if (g.slingArm && !g.slingArm.used && closestD > 6) {
      if (speed > g.slingArm.v * 1.08 && g.slingArm.v > 0.04) {
        g.slingArm.used = true;
        g.cinematic = { kind: 'sling', t: 0, dur: 3.4 };
        say(TIPS.sling);
      } else g.slingArm = null;
    }
  }

  function noteGoal() {
    const s = sys();
    if (!s.goal || g.goals[s.id]) return;
    const goal = s.goal;
    let ok = false;
    if (goal.type === 'survey') ok = !!g.surveyed[goal.planet];
    if (goal.type === 'land') ok = !!g.landedOnce[goal.planet] && (g.sideClock == null || g.sideClock > 0);
    if (goal.type === 'habitable') {
      const c = climateFor(goal.planet);
      ok = !!(c.habitable || c.liquid);
    }
    if (ok) {
      g.goals[s.id] = true;
      g.sideClock = null;
      g.coins += 15;
      g.research += 8;
      say('Challenge complete. ' + (s.name || 'The chart') + ' keeps your name on it.');
    }
  }

  function launch() {
    if (!g.docked || g.systemId !== 'proxima') return { ok: false, reason: 'The mast is at Infinity Command, in orbit of Proxima b.' };
    const list = bodies();
    const st = station(list);
    const home = list.find((b) => b.id === 'proxima-b');
    g.ship.x = st.x;
    g.ship.y = st.y;
    g.ship.vx = st.vx;
    g.ship.vy = st.vy;
    g.ship.heading = Math.atan2(st.vy - home.vy, st.vx - home.vx);
    g.docked = false;
    g.landed = null;
    g.cinematic = { kind: 'launch', t: 0, dur: 6.4 };
    say('Launch. You are already falling around Proxima b. A retrograde burn is what lets the ground rise to meet you.');
    return { ok: true };
  }

  function tryDock() {
    if (g.docked || g.landed || g.systemId !== 'proxima') return { ok: false, reason: 'Infinity Command orbits Proxima b.' };
    const st = station(bodies());
    const d = Math.hypot(g.ship.x - st.x, g.ship.y - st.y);
    const rel = Math.hypot(g.ship.vx - st.vx, g.ship.vy - st.vy);
    if (d > 0.7 || rel > 0.22) return { ok: false, reason: 'Match the station and come in close. HOLD MATCH helps.' };
    g.docked = true;
    g.ship.throttle = 0;
    g.matching = false;
    say('Docked at Infinity Command. Mission Control, the Flight Deck, and the Forge are open.');
    return { ok: true };
  }

  function tryLand() {
    if (g.docked || g.landed || g.cinematic) return { ok: false, reason: 'You are not in free flight.' };
    const b = targetBody();
    if (!b || b.kind !== 'planet') return { ok: false, reason: 'Select a world.' };
    const ap = approach(g.ship, b);
    if (!ap.canLand) {
      return { ok: false, reason: ap.tooFast ? 'Too fast for the heat shield. Hold RETRO until the relative speed falls.' : 'Closer. The corridor is a low, slow pass.' };
    }
    g.cinematic = { kind: 'entry', t: 0, dur: 6.8, planetId: b.id };
    g.ship.throttle = 0;
    g.matching = false;
    say('Entry. Plasma takes the last of the speed. Hold through it.');
    return { ok: true };
  }

  function takeoff() {
    if (!g.landed) return { ok: false, reason: 'You are not on a surface.' };
    if (g.ship.fuel < 0.06 && !(g.tech.ramjet)) return { ok: false, reason: 'Not enough propellant to climb. Refine ice, or buy fuel at the outpost.' };
    g.ship.fuel = Math.max(0, g.ship.fuel - 0.06);
    const list = bodies();
    const p = list.find((b) => b.id === g.landed);
    if (!p) return { ok: false, reason: 'The world is not on this chart.' };
    const ang = 0.6;
    const r = p.radius * 3.1;
    const v = Math.sqrt(p.gm / r);
    g.ship.x = p.x + Math.cos(ang) * r;
    g.ship.y = p.y + Math.sin(ang) * r;
    g.ship.vx = p.vx - Math.sin(ang) * v;
    g.ship.vy = p.vy + Math.cos(ang) * v;
    g.ship.heading = Math.atan2(g.ship.vy - p.vy, g.ship.vx - p.vx);
    g.landed = null;
    g.surface = null;
    g.miner = false;
    g.nurture = null;
    g.threat = null;
    g.cinematic = { kind: 'ascent', t: 0, dur: 4.6 };
    say('Climbing back to orbit.');
    return { ok: true };
  }

  function scan() {
    if (g.landed || g.docked) return { ok: false, reason: 'Probes launch from free flight.' };
    const b = targetBody();
    if (!b || b.kind !== 'planet') return { ok: false, reason: 'Select a world.' };
    const d = Math.hypot(g.ship.x - b.x, g.ship.y - b.y);
    if (d > Math.max(1.6, b.radius * 18)) return { ok: false, reason: 'Too far. Close the range and send the probe.' };
    if (!g.surveyPaid[b.id]) {
      g.surveyPaid[b.id] = true;
      g.research += 6;
      g.coins += 2;
    }
    g.surveyed[b.id] = true;
    const sig = beaconStrength(b.id);
    if (g.systemId === 'trappist' && !g.rescued && g.mayday != null) {
      if (sig >= 1) say('Probe down. The cutter is on this surface. Land while the cells hold.');
      else if (sig > 0.2) say('A faint echo. Not this world, but a neighbour.');
      else say('No beacon on this world.');
    } else {
      const c = climateFor(b.id);
      say(b.name + '. ' + Math.round(c.Tsurf) + ' K. ' + c.verdict);
    }
    noteGoal();
    return { ok: true, signal: sig };
  }

  function cycleTarget(dir) {
    const n = sys().planets.length || 1;
    g.target = (g.target + (dir || 1) + n * 4) % n;
    const b = targetBody();
    if (b) say(b.name + '. ' + (b.note || ''), 5);
  }

  function cycleWarp() {
    const steps = g.tech.ctime ? [1, 8, 40, 200] : [1, 8, 40];
    const i = Math.max(0, steps.indexOf(g.warp));
    g.warp = steps[(i + 1) % steps.length];
    say(g.tech.ctime ? 'Compressed time. Warp ' + g.warp + '.' : 'Warp ' + g.warp + '. It drops out near a world.', 3);
  }

  function canAfford(cost) {
    if ((g.research || 0) < (cost.research || 0)) return 'Need more survey data. Scan worlds, and mine.';
    if ((g.coins || 0) < (cost.coins || 0)) return 'Need more Challenge Coins.';
    for (const k of ['iron', 'ice', 'si', 'carbon', 'xe']) {
      if ((cost[k] || 0) > (g.ship.cargo[k] || 0)) return 'Need more ' + k + '. Mine it, or trade for it.';
    }
    return '';
  }

  function pay(cost) {
    g.research -= cost.research || 0;
    g.coins -= cost.coins || 0;
    for (const k of ['iron', 'ice', 'si', 'carbon', 'xe']) {
      if (cost[k]) g.ship.cargo[k] -= cost[k];
    }
  }

  function research(id) {
    const spec = TECH.find((t) => t.id === id);
    if (!spec) return { ok: false, reason: 'Unknown foundry pattern.' };
    if (g.tech[id]) return { ok: false, reason: 'Already aboard.' };
    for (const need of spec.needs) {
      if (need === 'rescued' && !g.rescued) return { ok: false, reason: 'The pilot’s notes are still on the surface.' };
      if (need !== 'rescued' && !g.tech[need]) {
        const prior = TECH.find((t) => t.id === need);
        return { ok: false, reason: 'Build ' + (prior ? prior.name : need) + ' first.' };
      }
    }
    const why = canAfford(spec.cost);
    if (why) return { ok: false, reason: why };
    pay(spec.cost);
    g.tech[id] = true;
    if (id === 'ion') g.ship.xe = Math.max(g.ship.xe, 0.8);
    say(spec.name + '. ' + spec.about);
    return { ok: true };
  }

  function refine() {
    const ice = g.ship.cargo.ice || 0;
    if (ice < 0.4) return { ok: false, reason: 'No ice to split into fuel.' };
    const take = Math.min(ice, 8);
    const gain = g.tech.ion ? 0.11 : 0.06;
    g.ship.cargo.ice -= take;
    g.ship.fuel = Math.min(1.7, g.ship.fuel + take * gain);
    say(g.tech.ion ? 'Hydrogen power. The same ice now buys a longer burn.' : TIPS.hydrogen);
    return { ok: true };
  }

  function depart(id) {
    const dest = catalog().find((s) => s.id === id);
    if (!dest) return { ok: false, reason: 'No such chart.' };
    if (dest.id === g.systemId && (g.docked || !g.landed)) return { ok: false, reason: 'You are already on this chart.' };
    if (g.landed) return { ok: false, reason: 'Lift to orbit before a crossing.' };
    if (dest.gate && !g.tech[dest.gate]) {
      const spec = TECH.find((t) => t.id === dest.gate);
      return { ok: false, reason: 'That crossing wants ' + (spec ? spec.name : dest.gate) + '.' };
    }
    const made = (g.universes || []).some((u) => u.id === dest.id) || FEATURED.some((f) => f.id === dest.id);
    if (!made && !g.tech.sail && !g.tech.ramjet && dest.id !== 'proxima') {
      return { ok: false, reason: 'Fit the solar sail. Chemical tanks will not cross between stars.' };
    }
    if (dest.id === 'behram' && !g.tech.sail && !g.tech.ramjet) {
      return { ok: false, reason: 'The Behram Nebula is a sail crossing.' };
    }
    const cost = g.tech.ramjet ? 0.03 : (dest.id === 'proxima' ? 0.04 : 0.08);
    if (g.ship.fuel < cost) return { ok: false, reason: 'Top up the tanks before the coast.' };
    g.ship.fuel -= cost;
    g.docked = false;
    g.landed = null;
    g.surface = null;
    g.matching = false;
    g.cinematic = { kind: 'depart', t: 0, dur: 7.2, to: id };
    say(g.tech.ramjet && dest.id !== 'proxima' ? TIPS.ramjet : (TIPS[dest.id] || 'Sail deployed. The coast is the quiet part.'));
    return { ok: true };
  }

  function setClimate(partial) {
    if (!g.landed) return { ok: false, reason: 'Land before you change a world.' };
    if (lockedChem(g.landed)) return { ok: false, reason: 'This world was actualized. The chemistry does not turn back.' };
    const cur = g.overrides[g.landed] || {};
    g.overrides[g.landed] = { ...cur, ...partial };
    if (g.threat && g.threat.id === 'climate' && !g.threat.handled && partial.greenhouse != null) {
      g.threat.handled = true;
      say('The drift slows. The lever did what a lecture could not.');
    }
    noteGoal();
    return { ok: true };
  }

  function seed() {
    if (!g.landed) return { ok: false, reason: 'Land first.' };
    const c = climateFor(g.landed);
    if (!c.habitable && !c.liquid) return { ok: false, reason: c.verdict };
    g.life[g.landed] = Math.max(g.life[g.landed] || 0, 0.2);
    g.nurture = { heat: 0.5, wet: 0.5, light: 0.45, stable: 0 };
    say('Seeded. Keep warmth, water, and light near the middle of their ranges.');
    return { ok: true };
  }

  function nudge(which, dir) {
    if (!g.nurture) return;
    g.nurture[which] = Math.max(0, Math.min(1, g.nurture[which] + dir));
    if (g.threat && g.threat.id === 'bio' && !g.threat.handled && g.tech.opto) {
      g.threat.handled = true;
      say('Optogenetics. The spike eases.');
    }
  }

  function respondThreat(action) {
    const t = g.threat;
    if (!t || t.handled) return { ok: false, reason: 'Nothing is bearing down.' };
    const ok = (
      (action === 'wait' && (t.id === 'storm' || t.id === 'quake' || t.id === 'orbitwin')) ||
      (action === 'shield' && t.id === 'pole' && (g.tech.shield || g.shieldOn)) ||
      (action === 'opto' && (t.id === 'disease' || t.id === 'bio') && g.tech.opto) ||
      (action === 'sat' && t.id === 'impactor' && g.robots.sat) ||
      (action === 'climate' && t.id === 'climate')
    );
    if (!ok) return { ok: false, reason: 'That answer does not fit this threat.' };
    if (action === 'climate') {
      say('Pull the greenhouse lever until the surface temperature steadies.');
      return { ok: true };
    }
    t.handled = true;
    if (t.id === 'quake') g.miner = false;
    g.research += 3;
    say('Answered. ' + t.name + ' passes.');
    return { ok: true };
  }

  function pointAlong(sign) {
    const sp = Math.hypot(g.ship.vx, g.ship.vy);
    if (sp < 0.015) return;
    g.ship.heading = Math.atan2(g.ship.vy, g.ship.vx) + (sign < 0 ? Math.PI : 0);
  }

  function trade(kind) {
    if (kind === 'sell-iron') {
      if ((g.ship.cargo.iron || 0) < 3) return { ok: false, reason: 'The outpost wants three iron.' };
      g.ship.cargo.iron -= 3;
      g.coins += 6;
      say('Iron across the counter. Six Challenge Coins.');
      return { ok: true };
    }
    if (kind === 'sell-ice') {
      if ((g.ship.cargo.ice || 0) < 3) return { ok: false, reason: 'The outpost wants three ice.' };
      g.ship.cargo.ice -= 3;
      g.coins += 4;
      say('Ice sold. Four Challenge Coins.');
      return { ok: true };
    }
    if (kind === 'buy-fuel') {
      if (g.coins < 6) return { ok: false, reason: 'Fuel is six coins.' };
      g.coins -= 6;
      g.ship.fuel = Math.min(1.7, g.ship.fuel + 0.35);
      say('Tanks topped.');
      return { ok: true };
    }
    if (kind === 'buy-xe') {
      if (g.coins < 8) return { ok: false, reason: 'Xenon is eight coins.' };
      g.coins -= 8;
      g.ship.xe = Math.min(2, g.ship.xe + 0.5);
      g.ship.cargo.xe = (g.ship.cargo.xe || 0) + 1;
      say('Xenon in the ion tanks.');
      return { ok: true };
    }
    return { ok: false, reason: 'The outpost does not stock that.' };
  }

  function buildRobot(id) {
    if (id === 'miner') {
      if (g.robots.miner) return { ok: false, reason: 'The miner is already in the bay.' };
      if ((g.ship.cargo.iron || 0) < 4) return { ok: false, reason: 'The miner wants four iron.' };
      g.ship.cargo.iron -= 4;
      g.robots.miner = true;
      say('Miner online. On a surface it digs while you walk.');
      return { ok: true };
    }
    if (id === 'sat') {
      if (g.robots.sat) return { ok: false, reason: 'A watcher is already overhead.' };
      if (g.coins < 8 || (g.ship.cargo.si || 0) < 3) return { ok: false, reason: 'The watcher wants eight coins and three silicon.' };
      g.coins -= 8;
      g.ship.cargo.si -= 3;
      g.robots.sat = true;
      say('Watcher satellite away. It will see a crossing rock in time to answer.');
      return { ok: true };
    }
    return { ok: false, reason: 'Unknown pattern.' };
  }

  function recharge() {
    if (g.rescued || !g.maydayLost) return { ok: false, reason: 'The beacon does not need a relay.' };
    if (g.coins < 10) return { ok: false, reason: 'The relay is ten Challenge Coins.' };
    g.coins -= 10;
    g.mayday = MAYDAY;
    g.maydayLost = false;
    say('Beacon back. The cells are counting again. TRAPPIST-1 e still holds the cutter.');
    return { ok: true };
  }

  function visitOneill() {
    g.oneill.visited = true;
    say('The O’Neill colony. A cylinder of air, soil, and window, built to live where there is no ground.');
    return { ok: true };
  }

  function settleOneill() {
    if (!g.oneill.visited) return { ok: false, reason: 'Visit the colony first.' };
    const alive = Object.keys(g.life).some((id) => (g.life[id] || 0) >= 0.8 && climateFor(id).habitable);
    if (!alive) return { ok: false, reason: 'Settle from a world that can already hold life.' };
    if (g.coins < 12) return { ok: false, reason: 'A habitat bay is twelve coins.' };
    g.coins -= 12;
    g.oneill.settled += 1;
    say('A bay is spoken for. The cylinder keeps their air.');
    return { ok: true };
  }

  function missions() {
    return [
      { id: 'shakedown', title: 'Shakedown', text: 'Land on Proxima b. Mine ice and iron for the sail.', done: !!(g.landedOnce['proxima-b'] && g.mined.ice >= 8 && g.mined.iron >= 6) },
      { id: 'mayday', title: 'Mayday', text: 'Fit the sail, cross to TRAPPIST-1, and bring the pilot up before the cells die.', done: !!g.rescued, locked: !g.tech.sail },
      { id: 'garden', title: 'Garden', text: 'Make a TRAPPIST world hold liquid water, then keep a seeded ecology alive.', done: g.bestLife >= 0.85, locked: !g.rescued },
      { id: 'farshore', title: 'Far Shore', text: 'Survey Kepler-186 f. Hydrogen power opens the crossing.', done: !!g.surveyed['kepler186-f'], locked: !g.tech.ion },
      { id: 'flare', title: 'Flare Watch', text: 'Raise magnetic transport and survey GJ 667 C b through the flares.', done: !!(g.surveyed['gj667-b'] && g.tech.shield), locked: !g.tech.shield },
      { id: 'cousin', title: 'Cousin', text: 'Read Kepler-452 b from orbit. The ramjet makes the Sun-like stars a day’s flight.', done: !!g.surveyed['kepler452-b'], locked: !g.tech.ramjet },
      { id: 'namesake', title: 'Namesake', text: 'Visit the Behram Star, in the Behram Nebula.', done: !!g.landedOnce['behram-b'] || !!g.surveyed['behram-b'], locked: !g.tech.sail && !g.tech.ramjet },
      { id: 'forge', title: 'Forge', text: 'Actualize a universe of your own. The chemistry will not turn back.', done: (g.universes || []).some((u) => u.actualized), locked: false }
    ];
  }

  function freshCompletions() {
    const out = [];
    for (const m of missions()) {
      if (m.done && !g.logged[m.id]) {
        g.logged[m.id] = true;
        g.coins += 12;
        out.push(m);
      }
    }
    return out;
  }

  function hint() {
    if (g.docked) return 'LAUNCH leaves you in orbit of Proxima b. A and D turn. W thrusts. RETRO points you backward along your path. MATCH flies that burn for you.';
    if (g.surface && g.surface.kind === 'rescue') return 'Fly the survey drone with the stick or the arrows. The range falls as you close. Hold RESCUE on the cutter.';
    if (g.landed) return 'Walk with the stick. Backers have jet-pack thrust on the holographic helmet. MINE, the climate levers, and LIFT live on the panel.';
    if (g.mayday != null) return 'TAB cycles worlds. SCAN from close orbit. The strong return is the cutter. LAND lights when you are slow and low.';
    return 'PROGRADE points along your motion. RETRO points against it. A retrograde burn drops the orbit. Warp waits, and cuts out near a world.';
  }

  function serialize() {
    return {
      v: 1,
      systemId: g.systemId, t: g.t, ship: g.ship, docked: g.docked, landed: g.landed,
      tech: g.tech, research: g.research, surveyed: g.surveyed, surveyPaid: g.surveyPaid,
      mined: g.mined, landedOnce: g.landedOnce, rescued: g.rescued, mayday: g.mayday,
      maydayLost: g.maydayLost, sideClock: g.sideClock, overrides: g.overrides, life: g.life,
      bestLife: g.bestLife, warp: g.warp, target: g.target, sailOn: g.sailOn, shieldOn: g.shieldOn,
      surface: g.surface && g.surface.kind === 'rescue' ? g.surface : (g.landed ? { kind: 'field' } : null),
      coins: g.coins, backer: g.backer, founder: true, suit: g.suit, shipDesign: g.shipDesign,
      robots: g.robots, universes: g.universes, actualized: g.actualized, logged: g.logged,
      goals: g.goals, oneill: g.oneill, eva: g.eva, author: g.author, seen: g.seen
    };
  }

  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify(serialize())); } catch (err) { /* private mode */ }
  }

  function addUniverse(record) {
    const clean = { ...record };
    g.universes = (g.universes || []).filter((u) => u.id !== clean.id).concat([clean]);
    return clean;
  }

  function actualize(id) {
    const u = (g.universes || []).find((item) => item.id === id);
    if (!u) return { ok: false, reason: 'Save the universe in the Forge first.' };
    if (u.actualized || g.actualized[id]) return { ok: false, reason: 'Already actualized. There is no way back.' };
    const cost = g.tech.singularity ? 4 : 10;
    if (g.coins < cost) return { ok: false, reason: 'Actualizing spends ' + cost + ' Challenge Coins.' };
    g.coins -= cost;
    u.actualized = true;
    g.actualized[id] = true;
    say('Actualized. The chemistry is committed. You are responsible for what this world becomes.');
    return { ok: true };
  }

  return {
    g,
    bodies, station, targetBody, say, climateFor, look, step, launch, tryDock, tryLand, takeoff,
    scan, cycleTarget, cycleWarp, research, refine, depart, setClimate, seed, nudge, hint, missions,
    serialize, save, sys, findPlanet, catalog, pointAlong, trade, buildRobot, respondThreat,
    recharge, visitOneill, settleOneill, freshCompletions, addUniverse, actualize, noteGoal,
    lockedChem, mine, hydrate,
    deltaV() { return deltaV(g.ship, (DRIVES[g.ship.drive] || DRIVES.chem).ve || 1.75); },
    mass() { return shipMass(g.ship); }
  };
}

export function loadGame() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE) || 'null');
    if (raw && raw.v === 1) return createGame(raw);
  } catch (err) { /* ignore */ }
  return null;
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE); } catch (err) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE); } catch (err) { /* ignore */ }
}

export { DRIVES, TECH, TIPS, SYSTEMS, MAYDAY, NAMES, FEATURED };
