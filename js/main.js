// Game flow: home, levels, daily challenge, results, sheets, effects wiring.
(() => {
  'use strict';
  const LP = window.LP, E = LP.Engine, R = LP.Render, S = LP.Sfx;
  const P = () => LP.profile;
  const $ = (s) => document.querySelector(s);
  const ic = (id, cls = '') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
  const DT = 1 / 120;
  const URL_GAME = 'https://lav-studio-org.github.io/letup/';

  const SPECIALS = {
    koin: { title: 'Gelembung Koin', text: 'Letupkan untuk dapat +3 koin.' },
    bom: { title: 'Gelembung Bom', text: 'Ledakannya hampir 2x lebih besar.' },
    belah: { title: 'Gelembung Pembelah', text: 'Menembakkan 4 ledakan kecil.' },
    es: { title: 'Gelembung Es', text: 'Semua gelembung melambat sebentar.' },
    baja: { title: 'Gelembung Baja', text: 'Harus kena ledakan 2 kali.' },
    hantu: { title: 'Gelembung Hantu', text: 'Timbul tenggelam. Cuma bisa kena saat terlihat.' },
    magnet: { title: 'Gelembung Magnet', text: 'Saat meletup, menarik gelembung di sekitarnya.' },
  };
  const BOSS_INFO = { title: 'Level Bos!', text: 'Tiap ledakan yang mengenai Raja Gelembung = 1 HP.' };
  const WORDS = { 5: 'Mantap!', 10: 'Keren!', 25: 'GILA!', 40: 'LUAR BIASA!', 60: 'LEGENDA!' };
  const SCALE_NAMES = { neon: 'Nada pentatonik ceria', permen: 'Nada kotak musik', laut: 'Nada minor tenang', galaksi: 'Nada Jepang hirajoshi', api: 'Nada blues' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  let world = null, state = 'home', mode = 'demo', paused = false;
  let timeScale = 1, slowT = 0, endTimer = 0, demoTimer = 2.5;
  let extraUsed = false, targetHit = false, stats = null, lastVib = 0, introTimer = 0;
  let last = performance.now(), acc = 0, touched = false, tutT = 0, tutSpot = null;

  // ---------- helpers ----------
  function vibrate(ms) {
    if (!P().vibrate || !navigator.vibrate || !touched || state === 'home') return;
    const now = performance.now();
    if (now - lastVib < 50) return;
    lastVib = now;
    try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }
  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  // animated "+N" so a reward is felt, not just read
  function countUp(el, to, ms = 700) {
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      el.innerHTML = `${ic('i-coin')}+${Math.round(to * (1 - Math.pow(1 - p, 3)))}`;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function fmtDate(d) { const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}`; }
  function bumpCoins() {
    for (const el of document.querySelectorAll('.coins')) {
      el.querySelector('span').textContent = P().coins;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
  }
  LP.on('coins', bumpCoins);

  function pickCluster(w) {
    let best = [E.W / 2, E.H / 2], bestN = -1;
    for (let k = 0; k < 14; k++) {
      const x = 30 + Math.random() * (E.W - 60), y = 30 + Math.random() * (E.H - 60);
      let n = 0;
      for (const b of w.bubbles) if (b.alive && (b.x - x) ** 2 + (b.y - y) ** 2 < 3000) n++;
      if (n > bestN) { bestN = n; best = [x, y]; }
    }
    return best;
  }

  // ---------- modal sheets ----------
  let onSheetClose = null;
  function openSheet(html, opts = {}) {
    const m = $('#modal'), s = $('#sheet');
    s.innerHTML = html;
    m.classList.toggle('center', !!opts.center);
    m.classList.remove('hidden');
    onSheetClose = opts.onClose || null;
    m.onclick = opts.dismissable === false ? null : (e) => { if (e.target === m) closeSheet(); };
    s.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { S.click(); closeSheet(); }));
    s.scrollTop = 0;
    return s;
  }
  function closeSheet() {
    $('#modal').classList.add('hidden');
    const cb = onSheetClose; onSheetClose = null;
    if (cb) cb();
  }
  const head = (title, sub) => `<div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Tutup">${ic('i-close')}</button></div>${sub ? `<p class="sub">${sub}</p>` : ''}`;

  // ---------- home ----------
  function demoWorld() {
    return E.createWorld({ mode: 'demo', kind: 'demo', n: 44, target: 0, speed: 32,
      specials: { bom: 2, belah: 1, koin: 1, es: 0, baja: 0 }, seed: (Math.random() * 1e9) | 0 });
  }
  function goHome() {
    state = 'home'; mode = 'demo'; paused = false;
    world = demoWorld(); demoTimer = 1.8;
    R.clearFx();
    R.setInsets(0, 0);
    $('#home').classList.remove('hidden');
    ['#hud', '#hint', '#btn-super', '#intro', '#map'].forEach((s) => $(s).classList.add('hidden'));
    refreshHome();
  }
  function refreshHome() {
    const p = P();
    $('#home-coins span').textContent = p.coins;
    const streak = LP.dailyStreak();
    $('#home-streak span').textContent = streak;
    $('#home-streak').classList.toggle('hidden', streak <= 0);
    $('#home-stars span').textContent = LP.totalStars();
    const fr = LP.frontier();
    p.level = fr;
    $('#play-level').textContent = 'Level ' + fr;
    const ch = LP.chestProgress();
    $('#chest-fill').style.width = (100 * ch.have / ch.need) + '%';
    $('#chest-text').textContent = ch.ready ? 'Peti siap dibuka!' : `${ch.have}/${ch.need} bintang`;
    $('#btn-chest').classList.toggle('ready', ch.ready);
    const n = LP.missionsClaimable();
    $('#badge-missions').textContent = n;
    $('#badge-missions').classList.toggle('hidden', !n);
    $('#dot-daily').classList.toggle('hidden', LP.dailyTriesLeft() <= 0);
    const st = LP.totalStars();
    $('#home-stats').innerHTML = p.games ? nextGoalText(fr, st, p) : '';
  }
  // one line that says what to chase next, instead of lifetime numbers
  function nextGoalText(fr, st, p) {
    const c = E.chapterOf(fr);
    const gate = c < E.CHAPTERS.length ? E.chapterGate(c + 1) : 0;
    if (gate > st) return `${ic('i-lock')} Bab ${c + 1} butuh <b>${gate}</b> ${ic('i-star')} &middot; kurang <b>${gate - st}</b>`;
    if (E.levelShape(fr).kind === 'boss') return `${ic('i-crown')} Bos Bab ${c} menunggu &middot; rantai terbaik <b>x${p.bestChain}</b>`;
    return `Bab ${c}: <b>${E.CHAPTERS[c - 1].name}</b> &middot; ${ic('i-star')} <b>${LP.chapterStars(c)}</b>/30 &middot; rantai terbaik <b>x${p.bestChain}</b>`;
  }

  // ---------- play setup ----------
  function showPlayUi() {
    $('#home').classList.add('hidden');
    $('#map').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    requestAnimationFrame(() => {
      const hb = $('#hud').getBoundingClientRect().bottom;
      R.setInsets(hb + 8, 64 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0));
    });
    R.setInsets(80, 64);
  }

  function beginAttempt(cfg) {
    world = E.createWorld(cfg);
    acc = 0; slowT = 0; timeScale = 1; paused = false;
    extraUsed = false; targetHit = false; tutSpot = null; tutT = 0.4;
    stats = { pops: 0, chainMax: 0, bom: 0, fever: 0 };
    R.clearFx();
    showPlayUi();
    state = 'ready';
    updateHud();
    showReady();
  }

  function startLevel(L) {
    mode = 'level';
    const cfg = E.levelConfig(L);
    beginAttempt(cfg);
    $('#hud-title').textContent = cfg.kind === 'bonus' ? `BONUS · LEVEL ${L}` : cfg.kind === 'boss' ? `BOS · LEVEL ${L}` : `LEVEL ${L}`;
    // introduce a special bubble (or the boss, or a new chapter) the first time it shows up
    const p = P();
    p.seen = p.seen || [];
    p.chapterSeen = p.chapterSeen || [];
    // the chapter's own new mechanic comes first, so a player who jumps ahead meets what the chapter is about
    const unseen = (t) => cfg.specials[t] > 0 && !p.seen.includes(t);
    const chIntro = E.CHAPTERS[cfg.chapter - 1].intro;
    const fresh = chIntro && unseen(chIntro) ? chIntro : Object.keys(SPECIALS).find(unseen);
    const intro = $('#intro');
    intro.style.color = '';
    if (cfg.kind === 'boss') {
      intro.innerHTML = `${ic('i-crown')}<div><b>${BOSS_INFO.title}</b><span>${BOSS_INFO.text}</span></div>`;
      intro.style.color = '#ffd23f';
      intro.classList.remove('hidden');
      introTimer = 4;
    } else if (fresh) {
      p.seen.push(fresh); LP.save();
      intro.innerHTML = `${ic('b-' + fresh)}<div><b>Baru: ${SPECIALS[fresh].title}</b><span>${SPECIALS[fresh].text}</span></div>`;
      intro.classList.remove('hidden');
      introTimer = 4;
    } else if (cfg.index === 0 && !p.chapterSeen.includes(cfg.chapter)) {
      p.chapterSeen.push(cfg.chapter); LP.save();
      intro.innerHTML = `${ic('i-map')}<div><b>Bab ${cfg.chapter}: ${E.CHAPTERS[cfg.chapter - 1].name}</b><span>10 level baru, bos menunggu di ujung.</span></div>`;
      intro.classList.remove('hidden');
      introTimer = 3.5;
    } else if (cfg.kind === 'bonus') {
      intro.innerHTML = `${ic('i-gift')}<div><b>Level Bonus!</b><span>Ramai gelembung, target ringan, koin melimpah.</span></div>`;
      intro.style.color = '#ffd23f';
      intro.classList.remove('hidden');
      introTimer = 3;
    } else intro.classList.add('hidden');
    LP.track('level_start', { level: L });
  }

  function startDaily() {
    const d = LP.dailyState();
    if (LP.dailyTriesLeft() <= 0) return;
    mode = 'daily';
    beginAttempt(E.dailyConfig(d.date));
    $('#hud-title').textContent = 'HARIAN · ' + fmtDate(d.date).replace(/ \d{4}$/, '');
    $('#intro').classList.add('hidden');
    LP.track('daily_start', { date: d.date });
  }

  function showReady() {
    const hint = $('#hint');
    const first = mode === 'level' && !P().tutorialDone;
    hint.classList.toggle('big', first);
    const bossLv = mode === 'level' && world.cfg.boss;
    hint.querySelector('span').textContent = world.tapsUsed > 0 ? (bossLv && world.tapsLeft > 0 && !extraUsed ? 'Ketukan kedua! Habisi bosnya' : 'Ketukan bonus! Ketuk sekali lagi')
      : first ? 'Ketuk sekali, lihat ledakannya berantai!' : mode === 'daily' ? 'Board sama untuk semua pemain hari ini'
      : bossLv ? 'Kamu punya 2 ketukan. Mulai dekat bos' : 'Ketuk sekali di mana saja';
    hint.classList.remove('hidden');
    updateSuper();
  }

  function updateSuper() {
    const b = $('#btn-super');
    const show = state === 'ready' && mode === 'level' && (world.cfg.level >= 3 || P().supers > 0) && world.tapsUsed === 0;
    b.classList.toggle('hidden', !show);
    if (!show) return;
    b.classList.toggle('on', world.superNext);
    const cost = b.querySelector('.cost');
    if (world.superNext) { b.querySelector('.lbl').textContent = 'Super aktif!'; cost.innerHTML = ic('i-check'); cost.className = 'cost'; return; }
    b.querySelector('.lbl').textContent = 'Ledakan Super';
    const own = P().supers || 0, canPay = P().coins >= LP.SUPER_PRICE;
    cost.className = 'cost' + (own ? ' own' : canPay ? '' : ' ad');
    cost.innerHTML = own ? `${ic('i-bolt')}x${own}` : canPay ? `${ic('i-coin')}${LP.SUPER_PRICE}` : `${ic('i-video')}Gratis`;
  }

  async function onSuper(e) {
    e.stopPropagation();
    if (state !== 'ready' || !world || world.superNext) return;
    S.click();
    if (P().supers > 0) {
      P().supers--;
    } else if (P().coins >= LP.SUPER_PRICE) {
      LP.addCoins(-LP.SUPER_PRICE, 'super');
    } else {
      const ok = await LP.Ads.rewarded('super_blast');
      if (!ok) { toast('Iklan belum tersedia'); return; }
    }
    world.superNext = true;
    P().superCount++; LP.save();
    updateSuper();
    toast('Ledakan pertamamu jadi raksasa');
  }

  function updateHud() {
    if (!world) return;
    const w = world;
    $('#hud-coins span').textContent = P().coins;
    const bar = $('#hud-bar'), fill = $('#hud-fill'), mark = $('#hud-mark'), count = $('#hud-count');
    fill.style.width = (100 * w.popped / w.total) + '%';
    if (mode === 'daily') {
      mark.classList.add('hidden');
      count.textContent = 'Skor ' + w.score.toLocaleString('id-ID');
      count.classList.remove('hit'); bar.classList.remove('hit');
    } else if (w.cfg.boss) {
      const b = w.boss;
      mark.classList.add('hidden');
      fill.style.width = (100 * (b.maxHp - b.hp) / b.maxHp) + '%';
      const dead = !b.alive;
      const taps = '<i class="tap-pip"></i>'.repeat(w.tapsLeft);
      count.innerHTML = dead ? `BOS KALAH <small>${w.popped} meletup</small>` : `BOS ${b.hp}/${b.maxHp} <small>KETUKAN</small> ${taps}`;
      count.classList.toggle('hit', dead); bar.classList.toggle('hit', dead);
    } else {
      mark.classList.remove('hidden');
      mark.style.left = (100 * w.target / w.total) + '%';
      const hit = w.popped >= w.target;
      count.innerHTML = hit ? `${w.popped} <small>TARGET TERCAPAI</small>` : `${w.popped} / ${w.target} <small>TARGET</small>`;
      count.classList.toggle('hit', hit); bar.classList.toggle('hit', hit);
    }
    // star thresholds on the bar, so the 2nd and 3rd star are something to chase
    for (const [id, v] of [['#hud-s2', w.cfg.s2], ['#hud-s3', w.cfg.s3]]) {
      const el = $(id);
      const show = mode === 'level' && v > 0 && !w.cfg.boss;
      el.classList.toggle('hidden', !show);
      if (show) { el.style.left = (100 * Math.min(v, w.total) / w.total) + '%'; el.classList.toggle('got', w.popped >= v); }
    }
  }

  // ---------- input ----------
  function onPointer(e) {
    S.unlock();
    touched = true;
    if (paused || !$('#modal').classList.contains('hidden')) return;
    const p = R.toWorld(e.clientX, e.clientY);
    if (state === 'home') {
      // the home screen is a toy: tap to pop
      if (!world.active && p.x > -20 && p.x < E.W + 20 && p.y > -20 && p.y < E.H + 20) { E.tap(world, p.x, p.y); demoTimer = 4; }
      if (P().music) S.musicStart();
      return;
    }
    if (state !== 'ready') return;
    if (p.x < -30 || p.x > E.W + 30 || p.y < -30 || p.y > E.H + 30) return;
    if (E.tap(world, p.x, p.y)) {
      state = 'running';
      $('#hint').classList.add('hidden');
      $('#btn-super').classList.add('hidden');
      $('#intro').classList.add('hidden');
      if (P().music) S.musicStart();
    }
  }

  // ---------- events -> effects ----------
  function handleEvents() {
    const w = world, th = LP.theme();
    for (const ev of w.events) {
      switch (ev.type) {
        case 'tap':
          S.tap(ev.x / E.W);
          R.ring(ev.x, ev.y, th.glow, ev.big ? 110 : 70, 5);
          R.burst(ev.x, ev.y, '#ffffff', 12, 140);
          if (ev.big) { R.shake(8); R.flash(0.25, '#ffd23f'); }
          vibrate(14);
          break;
        case 'pop': {
          const c = { koin: '#ffc83d', bom: '#ff3b3b', es: '#bff4ff', baja: '#c8d3e6', hantu: '#e6e0ff', magnet: '#ff5a7a' }[ev.kind] || R.colorOf(ev.color);
          R.burst(ev.x, ev.y, c, 8, 80 + Math.min(ev.chain, 40) * 3);
          R.ring(ev.x, ev.y, c, 30, 2.5);
          S.pop(ev.chain, ev.x / E.W, ev.kind);
          vibrate(8);
          if (state === 'home') break;
          stats.pops++;
          if (ev.kind === 'bom') { stats.bom++; R.shake(7); R.ring(ev.x, ev.y, '#ff8a3d', 90, 6); }
          if (ev.kind === 'koin') R.text('+3', { x: ev.x, y: ev.y - 10, size: 20, color: '#ffd23f', life: 0.9, rise: 34 });
          if (ev.kind === 'es') { R.flash(0.22, '#bff4ff'); R.text('BEKU!', { x: ev.x, y: ev.y - 14, size: 26, color: '#bff4ff', life: 1 }); }
          if (ev.kind === 'magnet') R.ring(ev.x, ev.y, '#ff5a7a', 120, 4);
          if (mode === 'level' && !w.cfg.boss && !targetHit && w.popped >= w.target) {
            targetHit = true;
            R.text('TARGET!', { y: E.H * 0.6, size: 40, color: '#7cff6b', life: 1.1 });
            S.coin();
            const bar = $('#hud-bar'); bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse');
          }
          break;
        }
        case 'bossHit':
          S.crack(ev.x / E.W); S.milestone(10);
          R.burst(ev.x, ev.y, th.glow, 16, 160);
          R.ring(ev.x, ev.y, '#ffd23f', 60, 5);
          R.text(`-1`, { x: ev.x, y: ev.y - 34, size: 26, color: '#ffd23f', life: 0.8, rise: 30 });
          R.shake(6); vibrate(25);
          break;
        case 'bossDown':
          S.fever(); S.win(true);
          R.text('BOS KALAH!', { size: 54, color: '#ffd23f', life: 1.8, slot: 'mid' });
          R.flash(0.35, '#ffd23f'); R.shake(14); slowT = 0.9;
          for (let i = 0; i < 8; i++) R.burst(ev.x, ev.y, th.colors[i % th.colors.length], 16, 320);
          R.ring(ev.x, ev.y, '#ffffff', 160, 8);
          vibrate(80);
          break;
        case 'crack':
          S.crack(ev.x / E.W);
          R.burst(ev.x, ev.y, '#c8d3e6', 6, 70);
          break;
        case 'fever':
          S.fever();
          R.flash(0.35, th.glow);
          if (state !== 'home') R.text('FEVER!', { size: 62, color: '#ffd23f', life: 1.4, slot: 'mid' });
          slowT = 0.35;
          vibrate(30);
          if (state !== 'home') stats.fever++;
          break;
        case 'milestone':
          if (WORDS[ev.chain] && state !== 'home') {
            S.milestone(ev.chain);
            R.text(WORDS[ev.chain], { size: 36 + Math.min(ev.chain, 60) / 3, color: ev.chain >= 25 ? '#ff7ab8' : '#fff', life: 1.1, slot: 'mid' });
            R.shake(3 + ev.chain / 8);
            if (ev.chain >= 25) slowT = 0.3;
            vibrate(20);
          }
          break;
        case 'perfect':
          if (state === 'home') break;
          R.text('SEMPURNA!', { size: 54, color: '#7cff6b', life: 1.8, slot: 'mid' });
          R.flash(0.5, '#ffffff');
          R.shake(10);
          slowT = 0.7;
          for (let i = 0; i < 6; i++) R.burst(E.W * (i + 0.5) / 6, E.H * 0.4, th.colors[i % th.colors.length], 18, 260);
          vibrate(60);
          break;
        case 'chainEnd':
          if (state === 'home') { demoTimer = 2.2; if (w.popped > w.total * 0.75) setTimeout(() => { if (state === 'home') world = demoWorld(); }, 900); break; }
          stats.chainMax = Math.max(stats.chainMax, ev.chain);
          state = 'settling';
          endTimer = 0.75;
          break;
      }
    }
    if (w.events.length && state !== 'home') updateHud();
    w.events.length = 0;
  }

  // ---------- results ----------
  function flushStats(extra) {
    const p = P();
    p.totalPops += stats.pops;
    p.bestChain = Math.max(p.bestChain, stats.chainMax);
    LP.missionProgress(Object.assign({ pops: stats.pops, chainMax: stats.chainMax, bom: stats.bom, fever: stats.fever }, extra));
    stats = { pops: 0, chainMax: 0, bom: 0, fever: 0 };
    LP.save();
  }

  function finishAttempt() {
    if (mode === 'daily') return dailyResult();
    if (E.won(world)) return levelWin();
    if (world.tapsLeft > 0) { state = 'ready'; showReady(); return; }
    levelLose();
  }

  function shareText(kind, data) {
    if (kind === 'daily') return `Skor harian LETUP! (${fmtDate(data.date)}): ${data.score.toLocaleString('id-ID')}. Board-nya sama buat semua, coba kalahin aku!`;
    return `Aku bikin rantai x${data.chain} di LETUP! level ${data.level}. Satu ketukan doang. Bisa ngalahin?`;
  }
  async function share(kind, data) {
    S.click();
    const text = shareText(kind, data);
    LP.track('share', { kind });
    try {
      if (navigator.share) { await navigator.share({ title: 'LETUP!', text, url: URL_GAME }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text + ' ' + URL_GAME); toast('Teks & link disalin, tinggal tempel'); }
    catch (e) { toast(URL_GAME); }
  }

  function levelWin() {
    state = 'result';
    const p = P(), w = world, L = w.cfg.level;
    const stars = E.stars(w);
    const prevStars = p.stars[L] || 0;
    p.stars[L] = Math.max(prevStars, stars);
    const boss = w.cfg.kind === 'boss';
    const firstBoss = boss && !p.bossBeaten.includes(L);
    if (firstBoss) p.bossBeaten.push(L);
    const perfect = w.popped >= w.total;
    const coins = 5 + stars * 3 + w.coins + (w.cfg.kind === 'bonus' ? 15 : 0) + (perfect ? 10 : 0) + (firstBoss ? 100 : 0);
    p.maxLevel = Math.max(p.maxLevel, L + 1);
    const next = Math.min(L + 1, E.MAX_LEVEL);
    const lock = L >= E.MAX_LEVEL ? 'end' : LP.lockReason(next);
    const nextCh = E.chapterOf(next);
    p.wins++; p.games++;
    p.tutorialDone = true;
    flushStats({ clears: 1, three: stars === 3 ? 1 : 0, boss: boss ? 1 : 0, starsGained: Math.max(0, stars - prevStars) });
    LP.addCoins(coins, 'level');
    LP.Ads.levelFinished();
    LP.track('level_win', { level: L, stars, popped: w.popped, chain: w.bestChain, taps: w.tapsUsed });
    S.win(stars === 3);
    const bestChain = w.bestChain;
    let doubled = false;
    const sheet = openSheet(`
      <h2>${boss ? 'BOS KALAH!' : stars === 3 ? 'Bintang 3!' : w.cfg.kind === 'bonus' ? 'Bonus Beres!' : `Level ${L} Beres!`}</h2>
      ${boss ? `<p class="sub">Bab ${w.cfg.chapter} selesai${firstBoss ? ' &middot; bonus bos +100 koin' : ''}</p>` : perfect ? '<p class="sub">Semua gelembung meletup &middot; +10 koin</p>' : ''}
      <div class="stars">${[0, 1, 2].map((i) => ic(i < stars ? 'i-star' : 'i-star-off')).join('')}</div>
      <div class="stat-row">
        <div class="stat"><div class="k">Letupan</div><div class="v">${w.popped}/${w.total}</div></div>
        <div class="stat"><div class="k">Rantai</div><div class="v">x${bestChain}</div></div>
        <div class="stat"><div class="k">Koin</div><div class="v" id="r-coins">${ic('i-coin')}+${coins}</div></div>
      </div>
      ${stars < 3 ? `<p class="near">${stars === 1 ? 'Bintang 2' : 'Bintang 3'}: letupkan ${stars === 1 ? w.cfg.s2 : w.cfg.s3} gelembung</p>` : ''}
      ${lock === 'stars' ? `<p class="gate-note">${ic('i-lock')} Bab ${nextCh} butuh ${E.chapterGate(nextCh)} bintang. Kamu punya ${LP.totalStars()}. Ulangi level untuk tambah bintang.</p>` : ''}
      <div class="actions">
        <button class="btn ad" id="r-double">${ic('i-video')}<span>2x Koin (+${coins})</span></button>
        ${lock === null ? `<button class="btn primary" id="r-next">${ic('i-play')}<span>Lanjut Level ${next}</span></button>`
          : `<button class="btn primary" id="r-map">${ic('i-map')}<span>${lock === 'end' ? 'Kamu menamatkan LETUP!' : 'Buka Peta'}</span></button>`}
        <div class="row">
          <button class="btn" id="r-home">${ic('i-home')}<span>Menu</span></button>
          <button class="btn" id="r-retry">${ic('i-retry')}<span>Ulang</span></button>
          <button class="btn" id="r-share">${ic('i-share')}<span>Pamer</span></button>
        </div>
      </div>`, { dismissable: false });
    sheet.querySelectorAll('.stars svg').forEach((el, i) => setTimeout(() => { el.classList.add('in'); if (i < stars) S.star(i); }, 250 + i * 260));
    countUp(sheet.querySelector('#r-coins'), coins, 900);
    sheet.querySelector('#r-double').onclick = async (e) => {
      if (doubled) return;
      const ok = await LP.Ads.rewarded('double_coins');
      if (!ok) { toast('Iklan belum tersedia'); return; }
      doubled = true;
      LP.addCoins(coins, 'double');
      S.coin();
      e.currentTarget.disabled = true;
      countUp(sheet.querySelector('#r-coins'), coins * 2, 600);
    };
    const nb = sheet.querySelector('#r-next');
    if (nb) nb.onclick = () => { S.click(); closeSheet(); afterResult(() => startLevel(next)); };
    const mb = sheet.querySelector('#r-map');
    if (mb) mb.onclick = () => { S.click(); closeSheet(); afterResult(() => { goHome(); mapScreen(L); }); };
    sheet.querySelector('#r-retry').onclick = () => { S.click(); closeSheet(); afterResult(() => startLevel(L)); };
    sheet.querySelector('#r-home').onclick = () => { S.click(); closeSheet(); afterResult(goHome); };
    sheet.querySelector('#r-share').onclick = () => share('level', { chain: bestChain, level: L });
  }

  function levelLose() {
    state = 'result';
    const p = P(), w = world, L = w.cfg.level;
    p.games++;
    flushStats({});
    LP.Ads.levelFinished();
    LP.track('level_lose', { level: L, popped: w.popped, target: w.target, extraUsed, boss: !!w.boss });
    S.lose();
    const boss = w.boss;
    const miss = boss ? boss.hp : w.target - w.popped;
    const pct = boss ? Math.round(100 * (boss.maxHp - boss.hp) / boss.maxHp) : Math.round(100 * w.popped / w.target);
    // a total miss needs advice, not a big "Kurang 39"
    const whiff = !boss && w.bestChain <= 1;
    const title = whiff ? 'Meleset!' : miss <= (boss ? 1 : 2) ? 'Tipis banget!' : pct >= 70 ? 'Hampir!' : 'Ayo, sekali lagi!';
    const tip = boss ? 'Mulai rantai di dekat bos, tiap ledakan yang mengenainya = 1 HP'
      : whiff ? 'Ketuk di tengah kumpulan gelembung yang rapat, bukan di ruang kosong'
      : pct < 50 ? 'Tunggu gelembung berkumpul dulu, lalu ketuk di tengahnya' : 'Sedikit lagi! Cari kumpulan yang paling padat';
    const sheet = openSheet(`
      <h2>${title}</h2>
      <div class="big-num miss ${whiff ? 'word' : ''}">${boss ? `Bos sisa ${miss} HP` : whiff ? 'Tidak ada rantai' : `Kurang ${miss}`}</div>
      <div class="prog"><i style="width:${pct}%"></i></div>
      <p class="near">${boss ? `HP bos ${boss.maxHp - boss.hp}/${boss.maxHp} berkurang` : `${w.popped} dari ${w.target} gelembung`}${w.bestChain > 1 ? ` &middot; rantai terbaik x${w.bestChain}` : ''}</p>
      <p class="tip">${ic('i-target')}<span>${tip}</span></p>
      <div class="actions">
        ${extraUsed ? '' : `<button class="btn ad" id="r-extra">${ic('i-video')}<span>+1 Ketukan, lanjut dari sini</span></button>`}
        <button class="btn primary" id="r-retry">${ic('i-retry')}<span>Coba Lagi</span></button>
        <div class="row"><button class="btn" id="r-home">${ic('i-home')}<span>Menu</span></button></div>
      </div>`, { dismissable: false });
    const ex = sheet.querySelector('#r-extra');
    if (ex) ex.onclick = async () => {
      const ok = await LP.Ads.rewarded('extra_tap');
      if (!ok) { toast('Iklan belum tersedia'); return; }
      extraUsed = true;
      p.games--; // the attempt continues, so it is not a finished game yet
      world.tapsLeft = 1;
      closeSheet();
      state = 'ready';
      showReady();
    };
    sheet.querySelector('#r-retry').onclick = () => { S.click(); closeSheet(); afterResult(() => startLevel(L)); };
    sheet.querySelector('#r-home').onclick = () => { S.click(); closeSheet(); afterResult(goHome); };
  }

  function dailyResult() {
    state = 'result';
    const w = world, d = LP.dailyState();
    const score = w.score;
    const isBest = LP.recordDaily(score);
    P().games++;
    flushStats({ daily: 1 });
    const coins = 10 + Math.min(60, Math.floor(score / 400));
    LP.addCoins(coins, 'daily');
    LP.track('daily_end', { score, popped: w.popped });
    S.win(w.popped === w.total);
    const left = LP.dailyTriesLeft();
    const canAd = left <= 0 && d.extra < LP.DAILY_EXTRA_MAX;
    const sheet = openSheet(`
      <h2>Tantangan Harian</h2>
      <p class="sub">${fmtDate(d.date)} &middot; ${ic('i-fire')} ${LP.dailyStreak()} hari beruntun</p>
      <div class="big-num">${score.toLocaleString('id-ID')}</div>
      ${isBest ? '<span class="new-best">REKOR BARU HARI INI</span>' : ''}
      <div class="stat-row">
        <div class="stat"><div class="k">Letupan</div><div class="v">${w.popped}/${w.total}</div></div>
        <div class="stat"><div class="k">Terbaik</div><div class="v">${d.best.toLocaleString('id-ID')}</div></div>
        <div class="stat"><div class="k">Koin</div><div class="v">${ic('i-coin')}+${coins}</div></div>
      </div>
      <div class="actions">
        <button class="btn primary" id="r-share">${ic('i-share')}<span>Tantang Teman</span></button>
        ${left > 0 ? `<button class="btn" id="r-again">${ic('i-retry')}<span>Main Lagi (${left})</span></button>` : ''}
        ${canAd ? `<button class="btn ad" id="r-ad">${ic('i-video')}<span>Coba Lagi</span></button>` : ''}
        <button class="btn" id="r-home">${ic('i-home')}<span>Menu</span></button>
      </div>`, { dismissable: false });
    sheet.querySelector('#r-share').onclick = () => share('daily', { score: d.best, date: d.date });
    const again = sheet.querySelector('#r-again');
    if (again) again.onclick = () => { S.click(); closeSheet(); startDaily(); };
    const ad = sheet.querySelector('#r-ad');
    if (ad) ad.onclick = async () => {
      const ok = await LP.Ads.rewarded('daily_try');
      if (!ok) { toast('Iklan belum tersedia'); return; }
      d.extra++; LP.save(); closeSheet(); startDaily();
    };
    sheet.querySelector('#r-home').onclick = () => { S.click(); closeSheet(); goHome(); };
  }

  async function afterResult(next) {
    await LP.Ads.maybeInterstitial('level_end');
    next();
  }

  // ---------- sheets: daily, missions, themes, settings, pause ----------
  function dailySheet() {
    S.click();
    const d = LP.dailyState(), left = LP.dailyTriesLeft();
    const canAd = left <= 0 && d.extra < LP.DAILY_EXTRA_MAX;
    const s = openSheet(`
      ${head('Tantangan Harian', fmtDate(d.date))}
      <div class="daily-hero">
        <div class="pill streak">${ic('i-fire')}<span>${LP.dailyStreak() ? LP.dailyStreak() + ' hari beruntun' : 'Mulai streak hari ini'}</span></div>
      </div>
      <p class="note" style="margin-top:6px">Satu board yang sama untuk semua pemain hari ini. Satu ketukan, kejar skor setinggi mungkin. Rantai panjang bikin skor meledak.</p>
      <div class="stat-row">
        <div class="stat"><div class="k">Hari ini</div><div class="v">${d.best ? d.best.toLocaleString('id-ID') : '-'}</div></div>
        <div class="stat"><div class="k">Rekor</div><div class="v">${P().bestDaily ? P().bestDaily.toLocaleString('id-ID') : '-'}</div></div>
        <div class="stat"><div class="k">Kesempatan</div><div class="v">${Math.max(0, left)}</div></div>
      </div>
      <div class="actions">
        ${left > 0 ? `<button class="btn primary" id="d-play">${ic('i-play')}<span>Main</span></button>` : ''}
        ${canAd ? `<button class="btn ad" id="d-ad">${ic('i-video')}<span>Tambah kesempatan</span></button>` : ''}
        ${left <= 0 && !canAd ? '<p class="near">Kesempatan hari ini habis. Board baru besok!</p>' : ''}
      </div>`);
    const play = s.querySelector('#d-play');
    if (play) play.onclick = () => { S.click(); closeSheet(); startDaily(); };
    const ad = s.querySelector('#d-ad');
    if (ad) ad.onclick = async () => {
      const ok = await LP.Ads.rewarded('daily_try');
      if (!ok) { toast('Iklan belum tersedia'); return; }
      d.extra++; LP.save(); closeSheet(); startDaily();
    };
  }

  function missionsSheet() {
    S.click();
    const render = () => {
      const ms = LP.missions();
      const s = openSheet(`
        ${head('Misi Harian', 'Misi baru tiap hari')}
        <div class="list">${ms.map((m) => `
          <div class="item ${m.claimed ? 'done' : ''}">
            <div class="grow">
              <div class="t">${m.text}</div>
              <div class="mini-row"><div class="mini"><i style="width:${100 * Math.min(1, m.progress / m.goal)}%"></i></div><span>${Math.min(m.progress, m.goal)}/${m.goal}</span></div>
            </div>
            ${m.claimed ? `<span class="claimed">${ic('i-check')}</span>`
              : m.done ? `<div class="claim-col"><button class="btn primary" data-claim="${m.id}">${ic('i-coin')}${m.reward}</button><button class="btn ad" data-claim2="${m.id}">${ic('i-video')}${m.reward * 2}</button></div>`
              : `<span class="reward">${ic('i-coin')}${m.reward}</span>`}
          </div>`).join('')}
        </div>`, { onClose: refreshHome });
      s.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = () => { LP.claimMission(b.dataset.claim, 1); S.coin(); render(); }));
      s.querySelectorAll('[data-claim2]').forEach((b) => (b.onclick = async () => {
        const ok = await LP.Ads.rewarded('mission_double');
        if (!ok) { toast('Iklan belum tersedia'); return; }
        LP.claimMission(b.dataset.claim2, 2); S.coin(); render();
      }));
    };
    render();
  }

  function themesSheet() {
    S.click();
    const render = () => {
      const p = P(), left = LP.freeCoinsLeft();
      const s = openSheet(`
        ${head('Tema', 'Tiap tema punya warna dan nada musik sendiri')}
        <div class="list">${LP.THEMES.map((t) => {
          const owned = p.themes.includes(t.id), used = p.theme === t.id;
          const dots = t.colors.slice(0, 5).map((c, i) => `<i style="background:${c};color:${c};left:${6 + (i % 3) * 18 + (i > 2 ? 9 : 0)}px;top:${i > 2 ? 28 : 8}px"></i>`).join('');
          return `<div class="item ${used ? 'sel' : ''}">
            <div class="swatch" style="background:linear-gradient(160deg,${t.bg[0]},${t.bg[1]})">${dots}</div>
            <div class="grow"><div class="t">${t.name}</div><div class="s">${ic('i-music')} ${SCALE_NAMES[t.id]}</div></div>
            ${used ? `<span class="btn" style="pointer-events:none">Dipakai</span>`
              : owned ? `<button class="btn" data-use="${t.id}">Pakai</button>`
              : `<button class="btn gold ${p.coins < t.price ? 'short' : ''}" data-buy="${t.id}">${ic('i-coin')}${t.price}</button>`}
          </div>`;
        }).join('')}</div>
        <div class="wallet">${ic('i-coin')}<span>Koinmu <b>${p.coins}</b></span>
          <button class="btn ad" id="t-free" ${left <= 0 ? 'disabled' : ''}>${ic('i-video')}<span>+${LP.FREE_COINS} (${left})</span></button>
        </div>`, { onClose: refreshHome });
      s.querySelector('#t-free').onclick = async () => {
        if (LP.freeCoinsLeft() <= 0) return;
        const ok = await LP.Ads.rewarded('free_coins');
        if (!ok) { toast('Iklan belum tersedia'); return; }
        P().freeCoins.count++;
        LP.addCoins(LP.FREE_COINS, 'free'); S.coin(); render();
      };
      s.querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => { applyTheme(b.dataset.use); S.click(); render(); }));
      s.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
        const t = LP.THEMES.find((x) => x.id === b.dataset.buy);
        if (P().coins < t.price) { toast(`Butuh ${t.price - P().coins} koin lagi`); return; }
        LP.addCoins(-t.price, 'theme');
        P().themes.push(t.id);
        applyTheme(t.id);
        S.win(true);
        LP.track('theme_buy', { id: t.id });
        render();
      }));
    };
    render();
  }

  function applyTheme(id) {
    const p = P();
    p.theme = id; LP.save();
    const t = LP.theme();
    R.setTheme(t);
    S.setTheme(t.id);
    document.documentElement.style.setProperty('--accent', t.glow);
    document.querySelector('meta[name=theme-color]').setAttribute('content', t.bg[0]);
  }

  function toggleRow(key, icon, label) {
    return `<button class="toggle ${P()[key] ? 'on' : ''}" data-tg="${key}">${ic(icon)}<span>${label}</span><i class="sw"></i></button>`;
  }
  function bindToggles(s) {
    s.querySelectorAll('[data-tg]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.tg, p = P();
      p[k] = !p[k]; LP.save();
      if (k === 'sound' || k === 'music') S.set(k, p[k]);
      if (k === 'vibrate' && p[k]) vibrate(20);
      b.classList.toggle('on', p[k]);
      S.click();
    }));
  }

  function settingsSheet() {
    S.click();
    const s = openSheet(`
      ${head('Pengaturan')}
      <div class="list">
        ${toggleRow('sound', 'i-sound', 'Suara')}
        ${toggleRow('music', 'i-music', 'Musik latar')}
        ${toggleRow('vibrate', 'i-vibrate', 'Getar')}
      </div>
      <h3 class="section-title">Gelembung spesial</h3>
      <div class="legend">${Object.keys(SPECIALS).map((k) => `<div>${ic('b-' + k)}<span><b>${SPECIALS[k].title.replace('Gelembung ', '')}</b>${SPECIALS[k].text}</span></div>`).join('')}</div>
      <p class="note">LETUP! v1.3 &middot; Satu ketukan per level. Rantai 15+ memicu FEVER: semua ledakan jadi lebih besar.</p>`);
    bindToggles(s);
  }

  // ---------- level map ----------
  function mapScreen(focusLevel) {
    S.click();
    const p = P(), total = LP.totalStars(), fr = LP.frontier();
    const focus = focusLevel || fr;
    const frCh = E.chapterOf(fr);
    const chapters = E.MAX_LEVEL / E.CHAPTER_SIZE;
    let html = '';
    for (let c = 1; c <= chapters; c++) {
      const gate = E.chapterGate(c);
      const first = (c - 1) * E.CHAPTER_SIZE + 1;
      const gated = c > 1 && LP.lockReason(first) === 'stars';
      const cs = LP.chapterStars(c);
      const hdr = `<header><div><small>BAB ${c}</small><b>${E.CHAPTERS[c - 1].name}</b></div>
        <span class="ch-stars">${ic('i-star')}${cs}/30</span></header>`;
      // chapters two or more steps ahead collapse to one line, so the map is about the next goal
      if (c > frCh + 1 && cs === 0) {
        html += `<section class="chapter mini" id="ch-${c}"><header><div><small>BAB ${c}</small><b>${E.CHAPTERS[c - 1].name}</b></div>
          <span class="ch-lock">${ic('i-lock')}${gate}</span></header></section>`;
        continue;
      }
      let nodes = '';
      for (let L = first; L < first + E.CHAPTER_SIZE; L++) {
        const st = p.stars[L] || 0, open = LP.isUnlocked(L), cfg = E.levelShape(L);
        const cls = ['node', cfg.kind, open ? 'open' : 'locked', L === fr ? 'current' : '', st ? 'done' : ''].join(' ');
        nodes += `<button class="${cls}" data-lv="${L}" aria-label="Level ${L}${open ? '' : ', terkunci'}">
          ${cfg.kind === 'boss' ? ic('i-crown', 'crown') : ''}
          <span class="num">${open ? L : ic('i-lock')}</span>
          ${open ? `<span class="mini-stars">${[0, 1, 2].map((i) => `<i class="${i < st ? 'on' : ''}"></i>`).join('')}</span>` : ''}
        </button>`;
      }
      html += `<section class="chapter ${gated ? 'gated' : ''} ${c === frCh ? 'here' : ''}" id="ch-${c}">
        ${hdr}
        <div class="ch-prog"><i style="width:${100 * cs / 30}%"></i></div>
        ${gated ? `<div class="gate">${ic('i-lock')}<span>Butuh <b>${gate}</b> bintang untuk membuka bab ini. Kurang <b>${gate - total}</b>, ulangi level lama untuk bintang 2 dan 3.</span></div>` : ''}
        <div class="nodes">${nodes}</div>
      </section>`;
    }
    const m = $('#map');
    m.querySelector('.map-stars span').textContent = total;
    const list = m.querySelector('.map-list');
    list.innerHTML = html;
    const cta = $('#map-cta');
    cta.querySelector('span').textContent = `Main Level ${fr}`;
    cta.onclick = () => { S.click(); m.classList.add('hidden'); startLevel(fr); };
    m.classList.remove('hidden');
    $('#home').classList.add('hidden');
    const target = list.querySelector(`[data-lv="${focus}"]`);
    if (target) target.closest('.chapter').scrollIntoView({ block: 'center' });
    list.onclick = (e) => {
      const b = e.target.closest('[data-lv]');
      if (!b) return;
      const L = +b.dataset.lv, why = LP.lockReason(L);
      if (why === 'stars') { toast(`Kumpulkan ${E.chapterGate(E.chapterOf(L)) - LP.totalStars()} bintang lagi`); return; }
      if (why) { toast('Selesaikan level sebelumnya dulu'); return; }
      levelPreview(L);
    };
  }

  // tapping a level on the map shows what each star costs before playing
  function levelPreview(L) {
    S.click();
    const cfg = E.levelConfig(L), st = P().stars[L] || 0;
    const kind = cfg.kind === 'boss' ? 'Level Bos' : cfg.kind === 'bonus' ? 'Level Bonus' : 'Level';
    const s = openSheet(`${head(`${kind} ${L}`, `Bab ${cfg.chapter} &middot; ${E.CHAPTERS[cfg.chapter - 1].name}`)}
      <div class="stars shown">${[0, 1, 2].map((i) => ic(i < st ? 'i-star' : 'i-star-off')).join('')}</div>
      <div class="goals">${goalRows(cfg)}</div>
      ${Object.keys(SPECIALS).some((t) => cfg.specials[t] > 0) ? `<div class="spec-row">${Object.keys(SPECIALS).filter((t) => cfg.specials[t] > 0).map((t) => `<span title="${SPECIALS[t].title}">${ic('b-' + t)}</span>`).join('')}</div>` : ''}
      <div class="actions"><button class="btn primary" id="lp-play">${ic('i-play')}<span>${st ? 'Main Lagi' : 'Main'}</span></button></div>`);
    s.querySelector('#lp-play').onclick = () => { S.click(); closeSheet(); $('#map').classList.add('hidden'); startLevel(L); };
  }
  function closeMap() { $('#map').classList.add('hidden'); $('#home').classList.remove('hidden'); refreshHome(); }

  // ---------- star chest ----------
  function chestSheet() {
    S.click();
    const ch = LP.chestProgress();
    if (!ch.ready) {
      openSheet(`${head('Peti Bintang', 'Tiap ' + LP.CHEST_EVERY + ' bintang membuka 1 peti')}
        <div class="chest-hero">${ic('i-chest')}</div>
        <div class="prog"><i style="width:${100 * ch.have / ch.need}%"></i></div>
        <p class="near">${ch.have} / ${ch.need} bintang. Ulangi level lama untuk bintang 2 dan 3!</p>
        <div class="actions"><button class="btn primary" id="c-map">${ic('i-map')}<span>Buka Peta</span></button></div>`);
      $('#c-map').onclick = () => { closeSheet(); mapScreen(); };
      return;
    }
    const r = LP.openChest();
    S.win(true);
    let doubled = false;
    const s = openSheet(`${head('Peti Terbuka!')}
      <div class="chest-hero open">${ic('i-chest')}</div>
      <div class="stat-row two">
        <div class="stat"><div class="k">Koin</div><div class="v">${ic('i-coin')}+${r.coins}</div></div>
        <div class="stat"><div class="k">Ledakan Super</div><div class="v">${ic('i-bolt')}+${r.supers}</div></div>
      </div>
      <div class="actions">
        <button class="btn ad" id="c-double">${ic('i-video')}<span>Gandakan hadiah</span></button>
        <button class="btn primary" data-close>Mantap</button>
      </div>`, { onClose: refreshHome });
    s.querySelector('#c-double').onclick = async (e) => {
      if (doubled) return;
      const ok = await LP.Ads.rewarded('chest_double');
      if (!ok) { toast('Iklan belum tersedia'); return; }
      doubled = true; e.currentTarget.disabled = true;
      P().supers += r.supers; LP.addCoins(r.coins, 'chest_double'); S.coin();
    };
  }

  // ---------- 7-day login reward ----------
  function rewardLabel(r) {
    return [r.coins ? `${ic('i-coin')}${r.coins}` : '', r.supers ? `${ic('i-bolt')}${r.supers}` : ''].join('');
  }
  function loginSheet() {
    const st = LP.loginState();
    if (!st.canClaim) return;
    const days = LP.LOGIN_REWARDS.map((r, i) => `<div class="day ${i < st.day ? 'past' : ''} ${i === st.day ? 'today' : ''} ${i === 6 ? 'big' : ''}">
      <small>Hari ${i + 1}</small>${i === 6 ? ic('i-gift', 'gift') : ''}<span>${rewardLabel(r)}</span>${i < st.day ? ic('i-check', 'ok') : ''}</div>`).join('');
    const s = openSheet(`${head('Hadiah Harian', 'Datang tiap hari, hadiah makin besar')}
      <div class="days">${days}</div>
      <div class="actions">
        <button class="btn ad" id="l-double">${ic('i-video')}<span>Ambil 2x</span></button>
        <button class="btn primary" id="l-claim">Ambil</button>
      </div>`, { dismissable: false });
    const claim = (mult) => { LP.claimLogin(mult); S.coin(); closeSheet(); refreshHome(); toast(mult > 1 ? 'Hadiah 2x diambil!' : 'Hadiah diambil!'); };
    s.querySelector('#l-claim').onclick = () => claim(1);
    s.querySelector('#l-double').onclick = async () => {
      const ok = await LP.Ads.rewarded('login_double');
      if (!ok) { toast('Iklan belum tersedia'); return; }
      claim(2);
    };
  }

  // what this attempt is worth, shown in pause and the level preview
  function goalRows(cfg) {
    if (cfg.mode !== 'level') return '';
    if (cfg.boss) return `<div class="goal"><span>${ic('i-crown')}Kalahkan bos</span><b>${cfg.boss} HP</b></div><div class="goal"><span>${ic('i-tap')}Ketukan</span><b>${cfg.taps}</b></div>`;
    return [[1, cfg.target], [2, cfg.s2], [3, cfg.s3]].map(([n, v]) =>
      `<div class="goal"><span class="gs">${[0, 1, 2].map((i) => ic(i < n ? 'i-star' : 'i-star-off')).join('')}</span><b>${v} gelembung</b></div>`).join('');
  }
  function goalCard() {
    if (mode !== 'level' || !world) return '';
    return `<div class="goals"><p class="goals-h">${world.cfg.kind === 'boss' ? 'Bos' : 'Level'} ${world.cfg.level} &middot; sekarang ${world.popped} meletup</p>${goalRows(world.cfg)}</div>`;
  }

  function pause() {
    if (state === 'home' || state === 'result' || paused) return;
    S.click();
    paused = true;
    $('#intro').classList.add('hidden');
    const s = openSheet(`
      <h2>Jeda</h2>
      ${goalCard()}
      <div class="list" style="margin-top:14px">${toggleRow('sound', 'i-sound', 'Suara')}${toggleRow('music', 'i-music', 'Musik latar')}${toggleRow('vibrate', 'i-vibrate', 'Getar')}</div>
      <div class="actions">
        <button class="btn primary" id="p-resume">${ic('i-play')}<span>Lanjut</span></button>
        <div class="row">
          <button class="btn" id="p-retry">${ic('i-retry')}<span>Ulangi</span></button>
          <button class="btn" id="p-home">${ic('i-home')}<span>Menu</span></button>
        </div>
      </div>`, { center: true, onClose: () => { paused = false; last = performance.now(); } });
    bindToggles(s);
    s.querySelector('#p-resume').onclick = () => { S.click(); closeSheet(); };
    s.querySelector('#p-retry').onclick = () => {
      S.click(); closeSheet();
      if (mode === 'daily') { goHome(); return; } // a daily try is only spent when finished
      startLevel(world.cfg.level);
    };
    s.querySelector('#p-home').onclick = () => { S.click(); closeSheet(); goHome(); };
  }

  // ---------- main loop ----------
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (slowT > 0) { slowT -= dt; timeScale = 0.3; }
    else timeScale += (1 - timeScale) * Math.min(1, dt * 5);
    const sdt = paused ? 0 : dt * timeScale;

    if (world && !paused) {
      acc += sdt;
      let n = 0;
      while (acc >= DT && n < 12) { E.step(world, DT); acc -= DT; n++; }
      if (n >= 12) acc = 0;
      handleEvents();
    }
    if (state === 'home' && world && !world.active && !paused) {
      demoTimer -= dt;
      if (demoTimer <= 0) { const [x, y] = pickCluster(world); E.tap(world, x, y); demoTimer = 4.5; }
    }
    if (state === 'settling' && !paused) {
      endTimer -= dt;
      if (endTimer <= 0) finishAttempt();
    }
    if (introTimer > 0) { introTimer -= dt; if (introTimer <= 0) { $('#intro').classList.add('hidden'); $('#intro').style.color = ''; } }
    if (state === 'ready' && mode === 'level' && !P().tutorialDone && world.tapsUsed === 0) {
      // first level: a pulsing ring suggests a good spot to tap
      tutT -= dt;
      if (tutT <= 0) { tutT = 1.1; if (!tutSpot || Math.random() < 0.3) tutSpot = pickCluster(world); R.ring(tutSpot[0], tutSpot[1], '#ffffff', 46, 3); }
    }
    R.frame(world, sdt, { noFrame: state === 'home', noChain: state === 'home', dim: state === 'home' ? 0.6 : 1 });
    requestAnimationFrame(loop);
  }

  // ---------- boot ----------
  function boot() {
    const p = P();
    R.init($('#cv'));
    applyTheme(p.theme);
    S.set('sound', p.sound);
    S.settings.music = p.music;
    $('#cv').addEventListener('pointerdown', onPointer);
    $('#btn-play').onclick = () => { S.unlock(); S.click(); if (p.music) S.musicStart(); startLevel(LP.frontier()); };
    $('#btn-daily').onclick = () => { S.unlock(); dailySheet(); };
    $('#btn-missions').onclick = () => { S.unlock(); missionsSheet(); };
    $('#btn-themes').onclick = () => { S.unlock(); themesSheet(); };
    $('#btn-settings').onclick = () => { S.unlock(); settingsSheet(); };
    $('#btn-pause').onclick = pause;
    $('#btn-map').onclick = () => { S.unlock(); mapScreen(); };
    $('#map-back').onclick = () => { S.click(); closeMap(); };
    $('#btn-chest').onclick = () => { S.unlock(); chestSheet(); };
    $('#btn-super').addEventListener('pointerdown', (e) => e.stopPropagation());
    $('#btn-super').onclick = onSuper;
    LP.on('missions', () => { if (state !== 'home') toast('Misi selesai! Ambil hadiahnya di menu Misi'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'ready' || state === 'running' || state === 'settling')) pause(); });
    goHome();
    if (p.tutorialDone) setTimeout(loginSheet, 600);
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
    LP.track('boot', { level: p.level });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Debug/test hook (used by scripts/smoke.js)
  window.__letup = {
    get state() { return state; }, get world() { return world; }, get mode() { return mode; },
    startLevel, startDaily, goHome, mapScreen, loginSheet,
    tapWorld(x, y) { const s = R.toScreen(x, y); onPointer({ clientX: s.x, clientY: s.y }); },
    cluster() { return pickCluster(world); },
  };

  boot();
})();
