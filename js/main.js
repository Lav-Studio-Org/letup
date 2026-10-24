// Game flow: home, levels, daily challenge, results, sheets, effects wiring.
(() => {
  'use strict';
  const LP = window.LP, E = LP.Engine, R = LP.Render, S = LP.Sfx;
  const P = () => LP.profile;
  const $ = (s) => document.querySelector(s);
  const ic = (id, cls = '') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
  const DT = 1 / 120;
  const URL_GAME = 'https://lavaruz.github.io/letup/';

  const SPECIALS = {
    koin: { title: 'Gelembung Koin', text: 'Letupkan untuk dapat +3 koin.' },
    bom: { title: 'Gelembung Bom', text: 'Ledakannya hampir 2x lebih besar.' },
    belah: { title: 'Gelembung Pembelah', text: 'Menembakkan 4 ledakan kecil.' },
    es: { title: 'Gelembung Es', text: 'Semua gelembung melambat sebentar.' },
    baja: { title: 'Gelembung Baja', text: 'Harus kena ledakan 2 kali.' },
  };
  const WORDS = { 5: 'Mantap!', 10: 'Keren!', 25: 'GILA!', 40: 'LUAR BIASA!', 60: 'LEGENDA!' };
  const SCALE_NAMES = { neon: 'Nada pentatonik ceria', permen: 'Nada kotak musik', laut: 'Nada minor tenang', galaksi: 'Nada Jepang hirajoshi', api: 'Nada blues' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  let world = null, state = 'home', mode = 'demo', paused = false;
  let timeScale = 1, slowT = 0, endTimer = 0, demoTimer = 2.5;
  let extraUsed = false, targetHit = false, stats = null, lastVib = 0, introTimer = 0;
  let last = performance.now(), acc = 0, touched = false;

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
    ['#hud', '#hint', '#btn-super', '#intro'].forEach((s) => $(s).classList.add('hidden'));
    refreshHome();
  }
  function refreshHome() {
    const p = P();
    $('#home-coins span').textContent = p.coins;
    $('#home-streak span').textContent = LP.dailyStreak();
    $('#play-level').textContent = 'Level ' + p.level;
    const n = LP.missionsClaimable();
    $('#badge-missions').textContent = n;
    $('#badge-missions').classList.toggle('hidden', !n);
    $('#dot-daily').classList.toggle('hidden', LP.dailyTriesLeft() <= 0);
    const st = LP.totalStars();
    $('#home-stats').innerHTML = p.games ? `Bintang <b>${st}</b> &middot; Rantai terbaik <b>x${p.bestChain}</b> &middot; Total letupan <b>${p.totalPops}</b>` : '';
  }

  // ---------- play setup ----------
  function showPlayUi() {
    $('#home').classList.add('hidden');
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
    extraUsed = false; targetHit = false;
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
    $('#hud-title').textContent = cfg.kind === 'bonus' ? `BONUS · LEVEL ${L}` : `LEVEL ${L}`;
    // introduce a special bubble the first time it shows up
    const p = P();
    p.seen = p.seen || [];
    const fresh = ['koin', 'bom', 'belah', 'es', 'baja'].find((t) => cfg.specials[t] > 0 && !p.seen.includes(t));
    const intro = $('#intro');
    if (fresh) {
      p.seen.push(fresh); LP.save();
      intro.innerHTML = `${ic('b-' + fresh)}<div><b>Baru: ${SPECIALS[fresh].title}</b><span>${SPECIALS[fresh].text}</span></div>`;
      intro.classList.remove('hidden');
      introTimer = 4;
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
    hint.querySelector('span').textContent = world.tapsUsed > 0 ? 'Ketukan bonus! Ketuk sekali lagi'
      : first ? 'Ketuk sekali, lihat ledakannya berantai!' : mode === 'daily' ? 'Board sama untuk semua pemain hari ini' : 'Ketuk sekali di mana saja';
    hint.classList.remove('hidden');
    updateSuper();
  }

  function updateSuper() {
    const b = $('#btn-super');
    const show = state === 'ready' && mode === 'level' && P().level >= 3 && world.tapsUsed === 0;
    b.classList.toggle('hidden', !show);
    if (!show) return;
    b.classList.toggle('on', world.superNext);
    const cost = b.querySelector('.cost');
    if (world.superNext) { b.querySelector('.lbl').textContent = 'Super aktif!'; cost.innerHTML = ic('i-check'); cost.className = 'cost'; return; }
    b.querySelector('.lbl').textContent = 'Ledakan Super';
    const canPay = P().coins >= LP.SUPER_PRICE;
    cost.className = 'cost' + (canPay ? '' : ' ad');
    cost.innerHTML = canPay ? `${ic('i-coin')}${LP.SUPER_PRICE}` : `${ic('i-video')}Gratis`;
  }

  async function onSuper(e) {
    e.stopPropagation();
    if (state !== 'ready' || !world || world.superNext) return;
    S.click();
    if (P().coins >= LP.SUPER_PRICE) {
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
    } else {
      mark.classList.remove('hidden');
      mark.style.left = (100 * w.target / w.total) + '%';
      const hit = w.popped >= w.target;
      count.textContent = hit ? `Target tercapai \u00b7 ${w.popped}` : `${w.popped} / ${w.target}`;
      count.classList.toggle('hit', hit); bar.classList.toggle('hit', hit);
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
          const c = ev.kind === 'koin' ? '#ffc83d' : ev.kind === 'bom' ? '#ff3b3b' : ev.kind === 'es' ? '#bff4ff' : ev.kind === 'baja' ? '#c8d3e6' : R.colorOf(ev.color);
          R.burst(ev.x, ev.y, c, 8, 80 + Math.min(ev.chain, 40) * 3);
          R.ring(ev.x, ev.y, c, 30, 2.5);
          S.pop(ev.chain, ev.x / E.W, ev.kind);
          vibrate(8);
          if (state === 'home') break;
          stats.pops++;
          if (ev.kind === 'bom') { stats.bom++; R.shake(7); R.ring(ev.x, ev.y, '#ff8a3d', 90, 6); }
          if (ev.kind === 'koin') R.text('+3', { x: ev.x, y: ev.y - 10, size: 20, color: '#ffd23f', life: 0.9, rise: 34 });
          if (ev.kind === 'es') { R.flash(0.22, '#bff4ff'); R.text('BEKU!', { x: ev.x, y: ev.y - 14, size: 26, color: '#bff4ff', life: 1 }); }
          if (mode === 'level' && !targetHit && w.popped >= w.target) {
            targetHit = true;
            R.text('TARGET!', { y: E.H * 0.52, size: 40, color: '#7cff6b', life: 1.1 });
            S.coin();
            const bar = $('#hud-bar'); bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse');
          }
          break;
        }
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
    if (world.popped >= world.target) return levelWin();
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
    const coins = 5 + stars * 3 + w.coins + (w.cfg.kind === 'bonus' ? 15 : 0) + (stars === 3 ? 10 : 0);
    if (L === p.level) p.level = L + 1;
    p.maxLevel = Math.max(p.maxLevel, L + 1);
    p.wins++; p.games++;
    p.tutorialDone = true;
    flushStats({ clears: 1, three: stars === 3 ? 1 : 0 });
    LP.addCoins(coins, 'level');
    LP.Ads.levelFinished();
    LP.track('level_win', { level: L, stars, popped: w.popped, chain: w.bestChain, taps: w.tapsUsed });
    S.win(stars === 3);
    const bestChain = w.bestChain;
    let doubled = false;
    const sheet = openSheet(`
      <h2>${stars === 3 ? 'SEMPURNA!' : w.cfg.kind === 'bonus' ? 'Bonus Beres!' : `Level ${L} Beres!`}</h2>
      <div class="stars">${[0, 1, 2].map((i) => ic(i < stars ? 'i-star' : 'i-star-off')).join('')}</div>
      <div class="stat-row">
        <div class="stat"><div class="k">Letupan</div><div class="v">${w.popped}/${w.total}</div></div>
        <div class="stat"><div class="k">Rantai</div><div class="v">x${bestChain}</div></div>
        <div class="stat"><div class="k">Koin</div><div class="v" id="r-coins">${ic('i-coin')}+${coins}</div></div>
      </div>
      ${stars < 3 ? `<p class="near">${stars === 1 ? 'Bintang 2' : 'Bintang 3'}: letupkan ${stars === 1 ? w.target + Math.ceil((w.total - w.target) / 2) : w.total} gelembung</p>` : ''}
      <div class="actions">
        <button class="btn ad" id="r-double">${ic('i-video')}<span>2x Koin (+${coins})</span></button>
        <button class="btn primary" id="r-next">${ic('i-play')}<span>Lanjut Level ${L + 1}</span></button>
        <div class="row">
          <button class="btn" id="r-home" aria-label="Menu">${ic('i-home')}</button>
          <button class="btn" id="r-retry" aria-label="Ulangi">${ic('i-retry')}</button>
          <button class="btn" id="r-share">${ic('i-share')}<span>Pamer</span></button>
        </div>
      </div>`, { dismissable: false });
    sheet.querySelectorAll('.stars svg').forEach((el, i) => setTimeout(() => { el.classList.add('in'); if (i < stars) S.star(i); }, 250 + i * 260));
    sheet.querySelector('#r-double').onclick = async (e) => {
      if (doubled) return;
      const ok = await LP.Ads.rewarded('double_coins');
      if (!ok) { toast('Iklan belum tersedia'); return; }
      doubled = true;
      LP.addCoins(coins, 'double');
      S.coin();
      e.currentTarget.disabled = true;
      sheet.querySelector('#r-coins').innerHTML = `${ic('i-coin')}+${coins * 2}`;
    };
    sheet.querySelector('#r-next').onclick = () => { S.click(); closeSheet(); afterResult(() => startLevel(P().level > L ? L + 1 : P().level)); };
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
    LP.track('level_lose', { level: L, popped: w.popped, target: w.target, extraUsed });
    S.lose();
    const miss = w.target - w.popped;
    const pct = Math.round(100 * w.popped / w.target);
    const sheet = openSheet(`
      <h2>${miss <= 2 ? 'Tipis banget!' : 'Hampir!'}</h2>
      <div class="big-num miss">Kurang ${miss}</div>
      <div class="prog"><i style="width:${pct}%"></i></div>
      <p class="near">${w.popped} dari ${w.target} gelembung &middot; rantai terbaik x${w.bestChain}</p>
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
        <div class="pill streak">${ic('i-fire')}<span>${LP.dailyStreak()} hari beruntun</span></div>
      </div>
      <p class="note" style="margin-top:6px">Satu board yang sama untuk semua pemain hari ini. Satu ketukan, kejar skor setinggi mungkin. Rantai panjang bikin skor meledak.</p>
      <div class="stat-row">
        <div class="stat"><div class="k">Hari ini</div><div class="v">${d.best.toLocaleString('id-ID')}</div></div>
        <div class="stat"><div class="k">Rekor</div><div class="v">${P().bestDaily.toLocaleString('id-ID')}</div></div>
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
              <div class="s">${ic('i-coin')} ${m.reward} &middot; ${Math.min(m.progress, m.goal)}/${m.goal}</div>
              <div class="mini"><i style="width:${100 * Math.min(1, m.progress / m.goal)}%"></i></div>
            </div>
            ${m.claimed ? `<span style="color:#7cff6b;width:28px;height:28px">${ic('i-check')}</span>`
              : m.done ? `<div style="display:flex;flex-direction:column;gap:6px"><button class="btn primary" data-claim="${m.id}">Ambil</button><button class="btn ad" data-claim2="${m.id}">${ic('i-video')}2x</button></div>` : ''}
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
        <div class="actions" style="margin:0 0 14px">
          <button class="btn ad" id="t-free" ${left <= 0 ? 'disabled' : ''}>${ic('i-video')}<span>+${LP.FREE_COINS} koin gratis (${left})</span></button>
        </div>
        <div class="list">${LP.THEMES.map((t) => {
          const owned = p.themes.includes(t.id), used = p.theme === t.id;
          const dots = t.colors.slice(0, 5).map((c, i) => `<i style="background:${c};color:${c};left:${6 + (i % 3) * 18 + (i > 2 ? 9 : 0)}px;top:${i > 2 ? 28 : 8}px"></i>`).join('');
          return `<div class="item ${used ? 'sel' : ''}">
            <div class="swatch" style="background:linear-gradient(160deg,${t.bg[0]},${t.bg[1]})">${dots}</div>
            <div class="grow"><div class="t">${t.name}</div><div class="s">${ic('i-music')} ${SCALE_NAMES[t.id]}</div></div>
            ${used ? `<span class="btn" style="pointer-events:none">Dipakai</span>`
              : owned ? `<button class="btn" data-use="${t.id}">Pakai</button>`
              : `<button class="btn gold" data-buy="${t.id}">${ic('i-coin')}${t.price}</button>`}
          </div>`;
        }).join('')}</div>`, { onClose: refreshHome });
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
      <h3 style="margin:18px 0 0;font-size:17px">Gelembung spesial</h3>
      <div class="legend">${Object.keys(SPECIALS).map((k) => `<div>${ic('b-' + k)}<span><b style="color:#fff">${SPECIALS[k].title.replace('Gelembung ', '')}</b>: ${SPECIALS[k].text}</span></div>`).join('')}</div>
      <p class="note">LETUP! v1.0.1 &middot; Satu ketukan per level. Rantai 15+ memicu FEVER: semua ledakan jadi lebih besar.</p>`);
    bindToggles(s);
  }

  function pause() {
    if (state === 'home' || state === 'result' || paused) return;
    S.click();
    paused = true;
    const s = openSheet(`
      <h2>Jeda</h2>
      <div class="list" style="margin-top:14px">${toggleRow('sound', 'i-sound', 'Suara')}${toggleRow('music', 'i-music', 'Musik latar')}</div>
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
    R.frame(world, sdt, { noFrame: state === 'home', noChain: state === 'home' });
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
    $('#btn-play').onclick = () => { S.unlock(); S.click(); if (p.music) S.musicStart(); startLevel(P().level); };
    $('#btn-daily').onclick = () => { S.unlock(); dailySheet(); };
    $('#btn-missions').onclick = () => { S.unlock(); missionsSheet(); };
    $('#btn-themes').onclick = () => { S.unlock(); themesSheet(); };
    $('#btn-settings').onclick = () => { S.unlock(); settingsSheet(); };
    $('#btn-pause').onclick = pause;
    $('#btn-super').addEventListener('pointerdown', (e) => e.stopPropagation());
    $('#btn-super').onclick = onSuper;
    LP.on('missions', () => { if (state !== 'home') toast('Misi selesai! Ambil hadiahnya di menu Misi'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'ready' || state === 'running' || state === 'settling')) pause(); });
    goHome();
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
    LP.track('boot', { level: p.level });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Debug/test hook (used by scripts/smoke.js)
  window.__letup = {
    get state() { return state; }, get world() { return world; }, get mode() { return mode; },
    startLevel, startDaily, goHome,
    tapWorld(x, y) { const s = R.toScreen(x, y); onPointer({ clientX: s.x, clientY: s.y }); },
    cluster() { return pickCluster(world); },
  };

  boot();
})();
