// Captures every screen for design review. Usage: node scripts/shots.js [w] [h] [prefix]
const { chromium } = require('playwright');
const [w = 390, h = 844, pre = 'm'] = process.argv.slice(2);
const out = 'shots/audit';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: +w < 700, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.LP = { fastAds: true }; });
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(1500);
  const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `${out}/${pre}-${n}.png` }); };
  const close = () => p.evaluate(() => document.querySelector('#modal').classList.add('hidden'));
  await shot('01-home-new');
  await p.click('#btn-play'); await shot('02-ready-l1');
  const play = async () => {
    for (;;) {
      const [x, y] = await p.evaluate(() => __letup.cluster());
      await p.evaluate(([x, y]) => __letup.tapWorld(x, y), [x, y]);
      await p.waitForFunction(() => ['ready', 'result'].includes(__letup.state), null, { timeout: 30000 });
      await p.waitForTimeout(900);
      if (await p.evaluate(() => __letup.state) === 'result') return;
    }
  };
  const [x, y] = await p.evaluate(() => __letup.cluster());
  await p.evaluate(([x, y]) => __letup.tapWorld(x, y), [x, y]);
  await p.waitForTimeout(700); await shot('03-chain');
  await p.waitForFunction(() => __letup.state === 'result', null, { timeout: 30000 }); await p.waitForTimeout(1100); await shot('04-win');
  // give a returning-player profile
  await p.evaluate(() => { const pr = LP.profile; for (let L = 1; L <= 23; L++) pr.stars[L] = 1 + (L % 3); pr.coins = 640; pr.supers = 2; pr.games = 40; pr.tutorialDone = true; pr.maxLevel = 24; LP.save(); });
  await close(); await p.evaluate(() => __letup.goHome()); await shot('05-home-returning');
  await p.click('#btn-map'); await shot('06-map');
  await p.evaluate(() => document.querySelector('.map-list').scrollTop = 99999); await shot('07-map-end');
  await p.click('[data-lv="22"]'); await shot('18-preview'); await close();
  await p.click('#map-back');
  await p.evaluate(() => __letup.startLevel(20)); await shot('08-boss-ready');
  await p.evaluate(() => __letup.startLevel(57)); await shot('09-ready-l57');
  await p.evaluate(() => { const w = __letup.world; w.tapsLeft = 0; w.tapsUsed = 1; });
  await p.evaluate(() => __letup.startLevel(18));
  // force a lose: tap a corner
  await p.evaluate(() => __letup.tapWorld(2, 2));
  await p.waitForFunction(() => ['ready', 'result'].includes(__letup.state), null, { timeout: 30000 }); await p.waitForTimeout(900);
  await shot('10-lose');
  await close(); await p.click('#btn-pause').catch(() => {});
  await p.evaluate(() => __letup.startLevel(19)); await p.click('#btn-pause'); await shot('11-pause');
  await close(); await p.evaluate(() => __letup.goHome());
  for (const [btn, n] of [['#btn-daily', '12-daily'], ['#btn-missions', '13-missions'], ['#btn-themes', '14-themes'], ['#btn-settings', '15-settings']]) {
    await p.click(btn); await shot(n); await close();
  }
  await p.click('#btn-chest', { force: true }); await shot('16-chest'); await close();
  await p.evaluate(() => { LP.profile.login = { last: '', day: 0 }; __letup.loginSheet(); }); await shot('17-login'); await close();
  console.log(pre, errs.length ? errs : 'no errors');
  await b.close();
})();
