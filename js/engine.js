// LETUP! core simulation. Pure logic, no DOM, so it runs in the browser and in Node
// (scripts/balance.js uses it to check that every level is beatable).
//
// The world is a fixed 360x640 box, so gameplay is identical on every screen size.
// One tap creates a blast; any bubble touching a blast pops and becomes a blast itself.
(function (root) {
  'use strict';

  const W = 360, H = 640;
  const BUBBLE_R = 9;
  const BLAST_R = 50;
  const GROW = 0.22, HOLD = 1.2, SHRINK = 0.35;
  const LIFE = GROW + HOLD + SHRINK;
  const FEVER_AT = 15;
  const FEVER_MULT = 1.15;
  const SUPER_MULT = 1.65;
  const FREEZE_TIME = 2.6;
  const MILESTONES = [5, 10, 15, 25, 40, 60];

  // Radius multiplier of the blast a popped bubble leaves behind.
  const TYPES = {
    normal: 1,
    bom: 1.8,   // big blast
    belah: 0.9, // splitter: also fires 4 small travelling blasts
    es: 1,      // freeze: every bubble slows down for a moment
    koin: 1,    // coin: +3 coins
    baja: 1,    // steel: needs two hits
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Board shape for a level. The target comes from js/levels-data.js, which
  // scripts/gen-levels.js computes by simulating aimed taps on this exact board.
  const CYCLE_FROM = 51, MAX_TABLE = 100;
  function levelShape(L) {
    const rng = mulberry32(hashStr('lvl' + L));
    const kind = L % 5 === 0 ? 'bonus' : 'normal';
    // Keep density near the chain-reaction tipping point, where aim and timing matter most.
    let n = L <= 20 ? Math.round(32 + L * 0.9) : 46 + ((L * 7) % 11);
    if (kind === 'bonus') n = Math.min(n + 16, 66);
    const sp = { bom: 0, belah: 0, es: 0, koin: 0, baja: 0 };
    if (L >= 2) sp.koin = kind === 'bonus' ? 6 : 1 + (rng() < 0.35 ? 1 : 0);
    if (L >= 3) sp.bom = 1 + Math.floor(Math.min(L, 40) / 14);
    if (L >= 6) sp.belah = 1 + (L >= 20 ? 1 : 0);
    if (L >= 8) sp.es = rng() < 0.7 ? 1 : 0;
    if (L >= 11 && kind !== 'bonus') sp.baja = Math.min(2 + Math.floor((L - 11) / 5), 10);
    const speed = 36 + Math.min(L, 30) * 0.8;
    return { mode: 'level', level: L, kind, n, target: 0, speed, specials: sp, seed: hashStr('seed' + L) };
  }

  function levelConfig(level) {
    const L = Math.max(1, level | 0);
    // past the table, replay boards 51..100 (same board, same target)
    const src = L <= MAX_TABLE ? L : CYCLE_FROM + ((L - CYCLE_FROM) % (MAX_TABLE - CYCLE_FROM + 1));
    const cfg = levelShape(src);
    cfg.level = L;
    const table = LEVEL_TARGETS || [];
    cfg.target = table[src - 1] || Math.max(1, Math.round(cfg.n * 0.5));
    return cfg;
  }

  // Same board for every player on the same date: a score attack with no target.
  function dailyConfig(dateStr) {
    const rng = mulberry32(hashStr('daily' + dateStr));
    return {
      mode: 'daily', level: 0, kind: 'daily', date: dateStr,
      n: 62 + Math.floor(rng() * 8), target: 0, speed: 52,
      specials: { bom: 3, belah: 2, es: 1, koin: 2, baja: 3 },
      seed: hashStr('dseed' + dateStr),
    };
  }

  function createWorld(cfg) {
    const rng = mulberry32(cfg.seed);
    const bubbles = [];
    const margin = BUBBLE_R + 2;
    for (let i = 0; i < cfg.n; i++) {
      let x, y, ok = false;
      for (let tries = 0; tries < 40 && !ok; tries++) {
        x = margin + rng() * (W - 2 * margin);
        y = margin + rng() * (H - 2 * margin);
        ok = bubbles.every((b) => (b.x - x) ** 2 + (b.y - y) ** 2 > (BUBBLE_R * 3) ** 2);
      }
      const a = rng() * Math.PI * 2;
      const s = cfg.speed * (0.7 + rng() * 0.6);
      bubbles.push({
        id: i, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: BUBBLE_R,
        type: 'normal', color: Math.floor(rng() * 6), alive: true, cracked: false, immune: 0,
        phase: rng() * Math.PI * 2,
      });
    }
    // hand out special types to random bubbles
    const order = bubbles.map((b) => b.id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let k = 0;
    for (const t of ['bom', 'belah', 'es', 'koin', 'baja']) {
      for (let c = 0; c < (cfg.specials[t] || 0) && k < order.length; c++) bubbles[order[k++]].type = t;
    }
    return {
      cfg, w: W, h: H, t: 0, bubbles, blasts: [],
      total: cfg.n, target: cfg.target, popped: 0,
      tapsLeft: 1, tapsUsed: 0, active: false,
      chain: 0, bestChain: 0, fever: false, freeze: 0,
      score: 0, coins: 0, superNext: false, events: [],
    };
  }

  function addBlast(w, x, y, max, color, depth, vx = 0, vy = 0, small = false) {
    w.blasts.push({ x, y, vx, vy, r: 0, max, t: 0, color, depth, small });
  }

  function tap(w, x, y) {
    if (w.tapsLeft <= 0 || w.active) return false;
    x = Math.max(0, Math.min(W, x));
    y = Math.max(0, Math.min(H, y));
    w.tapsLeft--; w.tapsUsed++;
    w.active = true; w.chain = 0; w.fever = false;
    const big = w.superNext;
    addBlast(w, x, y, BLAST_R * (big ? SUPER_MULT : 1), -1, 0);
    w.superNext = false;
    w.events.push({ type: 'tap', x, y, big });
    return true;
  }

  function blastRadius(bl) {
    const t = bl.t;
    if (t < GROW) { const p = t / GROW; return bl.max * (1 - (1 - p) * (1 - p)); }
    if (t < GROW + HOLD) return bl.max * (1 + 0.04 * Math.sin((t - GROW) * 9));
    const p = (t - GROW - HOLD) / SHRINK;
    return bl.max * Math.max(0, 1 - p * p);
  }

  function pop(w, b, bl) {
    if (b.type === 'baja' && !b.cracked) {
      b.cracked = true; b.immune = 0.45;
      w.events.push({ type: 'crack', x: b.x, y: b.y });
      return;
    }
    b.alive = false;
    w.popped++; w.chain++;
    w.score += 10 * w.chain;
    const mult = TYPES[b.type] * (w.fever ? FEVER_MULT : 1);
    addBlast(w, b.x, b.y, BLAST_R * mult, b.color, bl.depth + 1);
    if (b.type === 'belah') {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        addBlast(w, b.x, b.y, 20, b.color, bl.depth + 1, Math.cos(a) * 230, Math.sin(a) * 230, true);
      }
    }
    if (b.type === 'es') w.freeze = FREEZE_TIME;
    if (b.type === 'koin') w.coins += 3;
    w.events.push({ type: 'pop', x: b.x, y: b.y, color: b.color, kind: b.type, chain: w.chain, depth: bl.depth + 1 });
    if (w.chain === FEVER_AT && !w.fever) { w.fever = true; w.events.push({ type: 'fever' }); }
    if (MILESTONES.includes(w.chain)) w.events.push({ type: 'milestone', chain: w.chain, x: b.x, y: b.y });
    if (w.popped === w.total) w.events.push({ type: 'perfect', x: b.x, y: b.y });
  }

  function step(w, dt) {
    w.t += dt;
    const slow = w.freeze > 0 ? 0.22 : 1;
    if (w.freeze > 0) w.freeze = Math.max(0, w.freeze - dt);

    for (const b of w.bubbles) {
      if (!b.alive) continue;
      b.x += b.vx * dt * slow;
      b.y += b.vy * dt * slow;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
      else if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
      if (b.immune > 0) b.immune -= dt;
    }

    const blasts = w.blasts;
    for (let i = blasts.length - 1; i >= 0; i--) {
      const bl = blasts[i];
      bl.t += dt;
      if (bl.t >= (bl.small ? LIFE * 0.55 : LIFE)) { blasts.splice(i, 1); continue; }
      if (bl.vx || bl.vy) {
        bl.x += bl.vx * dt; bl.y += bl.vy * dt;
        const damp = Math.exp(-3.2 * dt);
        bl.vx *= damp; bl.vy *= damp;
        if (bl.x < 0 || bl.x > W) bl.vx = -bl.vx;
        if (bl.y < 0 || bl.y > H) bl.vy = -bl.vy;
      }
      bl.r = blastRadius(bl);
    }

    const n = blasts.length;
    for (let i = 0; i < n; i++) {
      const bl = blasts[i];
      if (bl.r <= 0) continue;
      for (const b of w.bubbles) {
        if (!b.alive || b.immune > 0) continue;
        const rr = bl.r + b.r;
        const dx = b.x - bl.x, dy = b.y - bl.y;
        if (dx * dx + dy * dy < rr * rr) pop(w, b, bl);
      }
    }

    if (w.active && blasts.length === 0) {
      w.active = false;
      w.bestChain = Math.max(w.bestChain, w.chain);
      w.events.push({ type: 'chainEnd', chain: w.chain });
    }
  }

  // Stars for a finished level: 1 = target, 2 = halfway from target to all, 3 = every bubble.
  function stars(w) {
    if (w.cfg.mode !== 'level' || w.popped < w.target) return 0;
    if (w.popped >= w.total) return 3;
    return w.popped >= w.target + Math.ceil((w.total - w.target) / 2) ? 2 : 1;
  }

  let LEVEL_TARGETS = root.LP_LEVEL_TARGETS || null;
  if (!LEVEL_TARGETS && typeof require !== 'undefined') {
    try { LEVEL_TARGETS = require('./levels-data.js'); } catch (e) { LEVEL_TARGETS = null; }
  }

  const api = {
    W, H, BUBBLE_R, BLAST_R, FEVER_AT, LIFE,
    mulberry32, hashStr, levelShape, levelConfig, MAX_TABLE, dailyConfig, createWorld, tap, step, stars,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.LP = root.LP || {}).Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
