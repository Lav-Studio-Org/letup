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
    hantu: 1,   // ghost: fades in and out, can only be hit while visible
    magnet: 1.1, // magnet: pulls nearby bubbles in when it pops
    bos: 2.6,   // boss: has HP, takes one hit per blast, huge blast when it falls
  };
  const SPECIAL_ORDER = ['bom', 'belah', 'es', 'koin', 'baja', 'hantu', 'magnet'];
  const GHOST_PERIOD = 2.4, GHOST_ON = 1.5;
  const MAGNET_R = 120, MAGNET_TIME = 0.8, MAGNET_PULL = 150;
  const BOSS_R = 22;

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

  // ---------- level design ----------
  // 200 levels in 20 chapters of 10. In every chapter: levels 1-4 ramp up, level 5 is a
  // bonus breather, 6-9 ramp again, 10 is a boss. Each early chapter introduces one
  // mechanic and makes it the star of that chapter. Targets and star thresholds come
  // from js/levels-data.js, which scripts/gen-levels.js computes by simulating aimed
  // taps on these exact boards.
  const MAX_LEVEL = 200, CHAPTER_SIZE = 10;
  const CHAPTERS = [
    { name: 'Awal Letupan', intro: null },
    { name: 'Taman Bom', intro: 'bom' },
    { name: 'Hujan Pecahan', intro: 'belah' },
    { name: 'Kutub Beku', intro: 'es' },
    { name: 'Benteng Baja', intro: 'baja' },
    { name: 'Kabut Hantu', intro: 'hantu' },
    { name: 'Medan Magnet', intro: 'magnet' },
    { name: 'Gugusan Bintang', intro: null, layout: 'gugus' },
    { name: 'Cincin Neon', intro: null, layout: 'cincin' },
    { name: 'Pusaran', intro: null, layout: 'spiral' },
    { name: 'Kebun Permen', intro: null },
    { name: 'Lautan Dalam', intro: null },
    { name: 'Gurun Api', intro: null },
    { name: 'Kota Kaca', intro: null, layout: 'garis' },
    { name: 'Hutan Kabut', intro: null, feature: 'hantu' },
    { name: 'Laboratorium', intro: null, feature: 'magnet' },
    { name: 'Puncak Es', intro: null, feature: 'es' },
    { name: 'Orbit', intro: null, layout: 'cincin' },
    { name: 'Inti Galaksi', intro: null },
    { name: 'Takhta Letup', intro: null },
  ];
  const INTRO_CHAPTER = { koin: 1, bom: 2, belah: 3, es: 4, baja: 5, hantu: 6, magnet: 7 };
  const LAYOUTS = ['acak', 'acak', 'acak', 'gugus', 'cincin', 'garis', 'spiral'];

  function chapterOf(L) { return Math.ceil(L / CHAPTER_SIZE); }

  function levelShape(L) {
    L = Math.max(1, Math.min(MAX_LEVEL, L | 0));
    const rng = mulberry32(hashStr('lvl2-' + L));
    const c = chapterOf(L), i = (L - 1) % CHAPTER_SIZE;
    const ch = CHAPTERS[c - 1];
    const kind = i === 9 ? 'boss' : i === 4 ? 'bonus' : 'normal';
    let n = Math.round(Math.min(38 + (c - 1) * 0.8, 54) + i * 0.6 + (rng() * 4 - 2));
    if (kind === 'bonus') n += 14;
    if (kind === 'boss') n += 4;
    const speed = 34 + Math.min(c, 15) * 1.5 + i * 0.4;

    const sp = { bom: 0, belah: 0, es: 0, koin: 0, baja: 0, hantu: 0, magnet: 0 };
    if (L >= 2) sp.koin = kind === 'bonus' ? 6 : 1 + (rng() < 0.3 ? 1 : 0);
    const featured = ch.intro || ch.feature;
    for (const t of ['bom', 'belah', 'es', 'baja', 'hantu', 'magnet']) {
      if (INTRO_CHAPTER[t] > c) continue;
      if (t === featured) sp[t] = Math.min(2 + Math.floor(i / 3) + (t === 'baja' || t === 'hantu' ? 2 : 0), 7);
      else if (t === 'baja') sp[t] = c >= 6 ? Math.min(1 + Math.floor(c / 4), 6) : 0;
      else if (t === 'hantu') sp[t] = rng() < 0.5 ? Math.min(1 + Math.floor(c / 6), 4) : 0;
      else sp[t] = rng() < 0.55 ? 1 + (rng() < 0.3 ? 1 : 0) : 0;
    }
    if (kind === 'bonus') { sp.baja = 0; sp.hantu = 0; }
    // chapter 1 stays pure so new players learn the core loop first
    let layout = c === 1 && i < 3 ? 'acak' : ch.layout && rng() < 0.7 ? ch.layout : LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
    if (kind === 'boss') layout = 'acak';
    const boss = kind === 'boss' ? Math.min(3 + Math.floor(c / 3), 9) : 0;
    return {
      mode: 'level', level: L, chapter: c, index: i, kind, n, speed, specials: sp, layout,
      boss, taps: kind === 'boss' ? 2 : 1, target: 0, s2: 0, s3: 0, variant: 0, seed: hashStr('seed2-' + L),
    };
  }

  // A level can use one of several candidate boards; the generator keeps the juiciest.
  function setVariant(cfg, v) { cfg.variant = v; cfg.seed = hashStr('seed2-' + cfg.level + (v ? '-' + v : '')); return cfg; }

  function levelConfig(level, overrides) {
    const cfg = levelShape(level);
    const row = (LEVEL_DATA || [])[cfg.level - 1];
    if (row) { cfg.target = row[0]; cfg.s2 = row[1]; cfg.s3 = row[2]; if (row[3]) cfg.boss = row[3]; if (row[4]) setVariant(cfg, row[4]); }
    else { cfg.target = cfg.boss ? 0 : Math.max(1, Math.round(cfg.n * 0.3)); cfg.s2 = Math.round(cfg.n * 0.55); cfg.s3 = Math.round(cfg.n * 0.8); }
    // keep 1 < 2 < 3 stars distinct even on boards where nearly everything pops
    cfg.s3 = Math.min(cfg.s3, cfg.n);
    if (cfg.s3 - cfg.target < 2 && !cfg.boss) cfg.target = Math.max(1, cfg.s3 - 2);
    cfg.s2 = Math.max(cfg.target + 1, Math.min(cfg.s2, cfg.s3 - 1));
    return Object.assign(cfg, overrides || {});
  }

  // Stars needed in total before a chapter opens (chapter 1 is always open).
  function chapterGate(c) { return c <= 1 ? 0 : Math.ceil((c - 1) * CHAPTER_SIZE * 3 * 0.55); }

  // Same board for every player on the same date: a score attack with no target.
  function dailyConfig(dateStr) {
    const rng = mulberry32(hashStr('daily' + dateStr));
    return {
      mode: 'daily', level: 0, kind: 'daily', date: dateStr,
      n: 62 + Math.floor(rng() * 8), target: 0, speed: 52,
      specials: { bom: 3, belah: 2, es: 1, koin: 2, baja: 3, hantu: 2, magnet: 1 },
      seed: hashStr('dseed' + dateStr),
    };
  }

  function createWorld(cfg) {
    const rng = mulberry32(cfg.seed);
    const bubbles = [];
    const margin = BUBBLE_R + 2;
    const spots = layoutSpots(cfg.layout || 'acak', cfg.n, rng);
    const clampX = (v) => Math.max(margin, Math.min(W - margin, v));
    const clampY = (v) => Math.max(margin, Math.min(H - margin, v));
    for (let i = 0; i < cfg.n; i++) {
      let x, y, ok = false;
      if (spots) { x = clampX(spots[i][0]); y = clampY(spots[i][1]); ok = true; }
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
    for (const t of SPECIAL_ORDER) {
      for (let c = 0; c < (cfg.specials[t] || 0) && k < order.length; c++) bubbles[order[k++]].type = t;
    }
    let boss = null;
    if (cfg.boss) {
      const a = rng() * Math.PI * 2, s = cfg.speed * 0.45;
      boss = { id: cfg.n, x: W / 2, y: H * 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: BOSS_R, type: 'bos', color: 0,
        alive: true, cracked: false, immune: 0, phase: 0, hp: cfg.boss, maxHp: cfg.boss };
      bubbles.push(boss);
    }
    return {
      cfg, w: W, h: H, t: 0, bubbles, blasts: [], pulls: [], boss,
      total: cfg.n, target: cfg.target, popped: 0,
      tapsLeft: cfg.taps || 1, tapsUsed: 0, active: false,
      chain: 0, bestChain: 0, fever: false, freeze: 0,
      score: 0, coins: 0, superNext: false, events: [],
    };
  }

  // Start positions for patterned boards. The pattern drifts apart once bubbles move,
  // so tapping early rewards reading the shape.
  function layoutSpots(layout, n, rng) {
    const cx = W / 2, cy = H / 2, out = [];
    if (layout === 'gugus') {
      const k = 4 + Math.floor(rng() * 3), centers = [];
      for (let i = 0; i < k; i++) centers.push([50 + rng() * (W - 100), 60 + rng() * (H - 120)]);
      for (let i = 0; i < n; i++) {
        const c = centers[i % k], a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 34;
        out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
      }
    } else if (layout === 'cincin') {
      const rings = n > 30 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ring = i % rings, m = Math.ceil(n / rings), j = Math.floor(i / rings);
        const R = ring ? 70 : 140, a = (j / m) * Math.PI * 2 + ring * 0.3;
        out.push([cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 1.35]);
      }
    } else if (layout === 'garis') {
      const rows = Math.max(3, Math.round(n / 8)), per = Math.ceil(n / rows);
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / per), j = i % per;
        out.push([30 + (j + 0.5) * ((W - 60) / per) + (r % 2) * 10, 70 + r * ((H - 140) / Math.max(1, rows - 1))]);
      }
    } else if (layout === 'spiral') {
      for (let i = 0; i < n; i++) {
        const t = i / n, a = t * Math.PI * 7, R = 20 + t * 150;
        out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 1.5]);
      }
    } else return null;
    return out;
  }

  function ghostVisible(w, b) { return ((w.t + b.phase) % GHOST_PERIOD) < GHOST_ON; }

  function won(w) { return w.cfg.boss ? !!(w.boss && !w.boss.alive) : w.popped >= w.target; }

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
    if (b.type === 'bos') {
      // every blast can hurt the boss only once, so HP = number of different blasts needed
      if (bl.hitBoss) return;
      bl.hitBoss = true;
      b.hp--; b.immune = 0.12;
      if (b.hp > 0) { w.events.push({ type: 'bossHit', x: b.x, y: b.y, hp: b.hp }); return; }
      b.alive = false;
      w.score += 500;
      addBlast(w, b.x, b.y, BLAST_R * TYPES.bos, -1, bl.depth + 1);
      w.events.push({ type: 'bossDown', x: b.x, y: b.y });
      return;
    }
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
    if (b.type === 'magnet') w.pulls.push({ x: b.x, y: b.y, t: MAGNET_TIME });
    w.events.push({ type: 'pop', x: b.x, y: b.y, color: b.color, kind: b.type, chain: w.chain, depth: bl.depth + 1 });
    if (w.chain === FEVER_AT && !w.fever) { w.fever = true; w.events.push({ type: 'fever' }); }
    if (MILESTONES.includes(w.chain)) w.events.push({ type: 'milestone', chain: w.chain, x: b.x, y: b.y });
    if (w.popped === w.total && w.cfg.mode === 'level') w.events.push({ type: 'perfect', x: b.x, y: b.y });
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

    for (let i = w.pulls.length - 1; i >= 0; i--) {
      const p = w.pulls[i];
      p.t -= dt;
      if (p.t <= 0) { w.pulls.splice(i, 1); continue; }
      for (const b of w.bubbles) {
        if (!b.alive || b.type === 'bos') continue;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
        if (d < 4 || d > MAGNET_R) continue;
        const f = MAGNET_PULL * (1 - d / MAGNET_R) * dt;
        b.x += (dx / d) * f; b.y += (dy / d) * f;
      }
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
        if (b.type === 'hantu' && !ghostVisible(w, b)) continue;
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

  // Stars for a finished level: 1 = win, 2 and 3 = pop at least s2 / s3 bubbles.
  function stars(w) {
    const c = w.cfg;
    if (c.mode !== 'level' || !won(w)) return 0;
    if (w.popped >= c.s3) return 3;
    return w.popped >= c.s2 ? 2 : 1;
  }

  let LEVEL_DATA = root.LP_LEVEL_DATA || null;
  if (!LEVEL_DATA && typeof require !== 'undefined') {
    try { LEVEL_DATA = require('./levels-data.js'); } catch (e) { LEVEL_DATA = null; }
  }

  const api = {
    W, H, BUBBLE_R, BLAST_R, FEVER_AT, LIFE,
    MAX_LEVEL, CHAPTER_SIZE, CHAPTERS, setVariant, INTRO_CHAPTER, chapterOf, chapterGate, ghostVisible, won,
    mulberry32, hashStr, levelShape, levelConfig, dailyConfig, createWorld, tap, step, stars,
    setLevelData(d) { LEVEL_DATA = d; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.LP = root.LP || {}).Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
