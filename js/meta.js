// Player profile, coins, themes, daily challenge, missions, analytics stub.
(() => {
  'use strict';
  const LP = (window.LP = window.LP || {});
  const KEY = 'letup.profile.v1';

  // ---------- tiny event bus + analytics stub ----------
  const listeners = {};
  LP.on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  LP.emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));
  // Replace with Firebase/GameAnalytics later; every interesting moment already calls this.
  LP.track = (name, data) => { if (LP.debug) console.log('[track]', name, data || ''); };

  // ---------- themes ----------
  LP.THEMES = [
    { id: 'neon', name: 'Neon', price: 0, bg: ['#0b0620', '#1d0b45'], glow: '#ff4d9d',
      colors: ['#ff4d9d', '#38e1ff', '#ffd23f', '#7cff6b', '#b06bff', '#ff8a3d'] },
    { id: 'permen', name: 'Permen', price: 250, bg: ['#2a0d2e', '#61204f'], glow: '#ff9ecf',
      colors: ['#ff9ecf', '#a0e7ff', '#fff1a8', '#b8ffcb', '#d9b8ff', '#ffc2a1'] },
    { id: 'laut', name: 'Laut Dalam', price: 450, bg: ['#021a2b', '#06455e'], glow: '#3de0d0',
      colors: ['#3de0d0', '#4fa9ff', '#9cf6ff', '#2dd4a7', '#7f9cff', '#c2fff4'] },
    { id: 'galaksi', name: 'Galaksi', price: 700, bg: ['#05030f', '#22125a'], glow: '#8f7bff',
      colors: ['#e0d4ff', '#8f7bff', '#ff7bd5', '#7be0ff', '#fff3a3', '#b2fff0'] },
    { id: 'api', name: 'Api', price: 1000, bg: ['#1a0500', '#481206'], glow: '#ff5a1f',
      colors: ['#ff5a1f', '#ffb21f', '#ff2e4d', '#ffe066', '#ff8c42', '#ffd1a1'] },
  ];
  LP.theme = () => LP.THEMES.find((t) => t.id === LP.profile.theme) || LP.THEMES[0];

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  LP.today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  function dayDiff(a, b) { return Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5); }

  // ---------- profile ----------
  const DEFAULT = {
    v: 1, level: 1, maxLevel: 1, stars: {}, coins: 0, games: 0, wins: 0, totalPops: 0, bestChain: 0,
    themes: ['neon'], theme: 'neon', sound: true, music: true, vibrate: true, noAds: false, tutorialDone: false,
    daily: { date: '', best: 0, played: 0, extra: 0 }, streak: { last: '', count: 0 }, bestDaily: 0,
    missions: { date: '', list: [] }, freeCoins: { date: '', count: 0 }, superCount: 0,
  };
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.v === 1) return Object.assign(structuredClone(DEFAULT), raw);
    } catch (e) { /* storage blocked or corrupt */ }
    return structuredClone(DEFAULT);
  }
  LP.profile = load();
  LP.save = () => { try { localStorage.setItem(KEY, JSON.stringify(LP.profile)); } catch (e) { /* ignore */ } };

  LP.addCoins = (n, why) => {
    LP.profile.coins = Math.max(0, LP.profile.coins + n);
    LP.save();
    LP.track('coins', { n, why });
    LP.emit('coins', LP.profile.coins);
  };

  LP.totalStars = () => Object.values(LP.profile.stars).reduce((a, b) => a + b, 0);

  // ---------- daily challenge ----------
  LP.DAILY_EXTRA_MAX = 2; // extra tries from rewarded ads
  LP.dailyState = () => {
    const p = LP.profile, t = LP.today();
    if (p.daily.date !== t) p.daily = { date: t, best: 0, played: 0, extra: 0 };
    return p.daily;
  };
  LP.dailyTriesLeft = () => { const d = LP.dailyState(); return 1 + d.extra - d.played; };
  LP.dailyStreak = () => {
    const s = LP.profile.streak;
    if (!s.last) return 0;
    return dayDiff(s.last, LP.today()) <= 1 ? s.count : 0;
  };
  LP.recordDaily = (score) => {
    const d = LP.dailyState(), p = LP.profile, t = LP.today();
    d.played++;
    const isBest = score > d.best;
    d.best = Math.max(d.best, score);
    p.bestDaily = Math.max(p.bestDaily, score);
    if (p.streak.last !== t) {
      p.streak.count = p.streak.last && dayDiff(p.streak.last, t) === 1 ? p.streak.count + 1 : 1;
      p.streak.last = t;
    }
    LP.save();
    return isBest;
  };

  // ---------- missions ----------
  const POOL = [
    { id: 'pops', stat: 'pops', goals: [120, 200, 300], text: (n) => `Letupkan ${n} gelembung`, reward: 40 },
    { id: 'chain', stat: 'chainMax', goals: [15, 25, 35], text: (n) => `Buat rantai ${n} dalam 1 ketukan`, reward: 60, max: true },
    { id: 'clear', stat: 'clears', goals: [3, 5, 8], text: (n) => `Selesaikan ${n} level`, reward: 50 },
    { id: 'three', stat: 'three', goals: [1, 2, 3], text: (n) => `Dapat 3 bintang ${n} kali`, reward: 70 },
    { id: 'bom', stat: 'bom', goals: [4, 8, 12], text: (n) => `Letupkan ${n} gelembung bom`, reward: 45 },
    { id: 'fever', stat: 'fever', goals: [2, 3, 5], text: (n) => `Masuk mode FEVER ${n} kali`, reward: 60 },
    { id: 'daily', stat: 'daily', goals: [1, 1, 1], text: () => 'Main Tantangan Harian', reward: 40 },
    { id: 'boss', stat: 'boss', goals: [1, 1, 2], text: (n) => `Kalahkan ${n} bos`, reward: 80, minLevel: 11 },
    { id: 'stars', stat: 'starsGained', goals: [3, 5, 8], text: (n) => `Kumpulkan ${n} bintang baru`, reward: 60 },
  ];
  LP.missions = () => {
    const p = LP.profile, t = LP.today();
    if (p.missions.date !== t) {
      const rng = LP.Engine.mulberry32(LP.Engine.hashStr('m' + t));
      const ids = POOL.filter((m) => !m.minLevel || p.maxLevel >= m.minLevel).map((m) => m.id);
      for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      const tier = Math.min(2, Math.floor((p.maxLevel - 1) / 12));
      p.missions = {
        date: t,
        list: ids.slice(0, 3).map((id) => {
          const m = POOL.find((x) => x.id === id);
          return { id, goal: m.goals[tier], progress: 0, claimed: false };
        }),
      };
      LP.save();
    }
    return p.missions.list.map((m) => {
      const def = POOL.find((x) => x.id === m.id);
      return Object.assign({}, m, { text: def.text(m.goal), reward: def.reward + 10 * Math.min(2, Math.floor((p.maxLevel - 1) / 12)), done: m.progress >= m.goal });
    });
  };
  // stats: {pops, chainMax, clears, three, bom, fever, daily}
  LP.missionProgress = (stats) => {
    LP.missions();
    let newlyDone = 0;
    for (const m of LP.profile.missions.list) {
      const def = POOL.find((x) => x.id === m.id);
      const v = stats[def.stat] || 0;
      if (!v) continue;
      const before = m.progress >= m.goal;
      m.progress = def.max ? Math.max(m.progress, v) : m.progress + v;
      m.progress = Math.min(m.progress, m.goal);
      if (!before && m.progress >= m.goal) newlyDone++;
    }
    LP.save();
    if (newlyDone) LP.emit('missions');
    return newlyDone;
  };
  LP.claimMission = (id, mult) => {
    const all = LP.missions();
    const m = all.find((x) => x.id === id);
    const raw = LP.profile.missions.list.find((x) => x.id === id);
    if (!m || !m.done || raw.claimed) return 0;
    raw.claimed = true;
    LP.addCoins(m.reward * (mult || 1), 'mission');
    return m.reward * (mult || 1);
  };
  LP.missionsClaimable = () => LP.missions().filter((m) => m.done && !m.claimed).length;

  // ---------- free coins (rewarded) ----------
  LP.FREE_COINS = 50;
  LP.FREE_COINS_PER_DAY = 5;
  LP.freeCoinsLeft = () => {
    const f = LP.profile.freeCoins, t = LP.today();
    if (f.date !== t) { f.date = t; f.count = 0; }
    return LP.FREE_COINS_PER_DAY - f.count;
  };

  LP.SUPER_PRICE = 40;

  // ---------- v1.2 profile fields (added in place, old saves keep their progress) ----------
  (() => {
    const p = LP.profile;
    if (p.legacyMax === undefined) {
      // players from v1.1 keep every level they had already reached
      p.legacyMax = p.games > 0 ? p.maxLevel : 0;
      p.supers = p.supers || 0;
      p.chestsOpened = 0;
      p.login = { last: '', day: 0 };
      p.bossBeaten = [];
      p.chapterSeen = [];
      LP.save();
    }
  })();

  const E = () => LP.Engine;

  // ---------- level map / star gates ----------
  LP.lockReason = (L) => {
    const p = LP.profile, e = E();
    if (L < 1 || L > e.MAX_LEVEL) return 'none';
    if (L === 1 || L <= p.legacyMax) return null;
    if (!(p.stars[L - 1] > 0)) return 'prev';
    if ((L - 1) % e.CHAPTER_SIZE === 0) {
      const c = e.chapterOf(L);
      if (LP.totalStars() < e.chapterGate(c)) return 'stars';
    }
    return null;
  };
  LP.isUnlocked = (L) => LP.lockReason(L) === null;
  // The level the big MAIN button plays: the furthest unlocked level.
  LP.frontier = () => {
    const e = E();
    let L = 1;
    while (L < e.MAX_LEVEL && LP.isUnlocked(L + 1)) L++;
    return L;
  };
  LP.chapterStars = (c) => {
    const e = E(), p = LP.profile;
    let n = 0;
    for (let L = (c - 1) * e.CHAPTER_SIZE + 1; L <= c * e.CHAPTER_SIZE; L++) n += p.stars[L] || 0;
    return n;
  };

  // ---------- star chest ----------
  LP.CHEST_EVERY = 15;
  LP.chestProgress = () => {
    const t = LP.totalStars(), opened = LP.profile.chestsOpened;
    const next = (opened + 1) * LP.CHEST_EVERY;
    return { have: Math.min(t - opened * LP.CHEST_EVERY, LP.CHEST_EVERY), need: LP.CHEST_EVERY, ready: t >= next };
  };
  LP.openChest = () => {
    const p = LP.profile;
    if (!LP.chestProgress().ready) return null;
    p.chestsOpened++;
    const reward = { coins: 40 + Math.min(p.chestsOpened, 20) * 5, supers: 1 };
    p.supers += reward.supers;
    LP.addCoins(reward.coins, 'chest');
    LP.track('chest_open', { n: p.chestsOpened });
    return reward;
  };

  // ---------- 7-day login reward ----------
  LP.LOGIN_REWARDS = [
    { coins: 30 }, { supers: 1 }, { coins: 60 }, { supers: 2 }, { coins: 100 }, { supers: 2, coins: 50 }, { coins: 200, supers: 3 },
  ];
  LP.loginState = () => {
    const p = LP.profile, t = LP.today();
    const last = p.login.last;
    if (last === t) return { day: (p.login.day + 6) % 7, canClaim: false };
    const keep = last && dayDiff(last, t) === 1;
    return { day: keep ? p.login.day % 7 : 0, canClaim: true };
  };
  LP.claimLogin = (mult) => {
    const st = LP.loginState();
    if (!st.canClaim) return null;
    const p = LP.profile, r = LP.LOGIN_REWARDS[st.day];
    p.login = { last: LP.today(), day: st.day + 1 };
    if (r.supers) p.supers += r.supers * (mult || 1);
    if (r.coins) LP.addCoins(r.coins * (mult || 1), 'login'); else LP.save();
    LP.track('login_reward', { day: st.day + 1, mult });
    return r;
  };
})();
