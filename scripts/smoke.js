// Headless smoke test: boots the game on a phone viewport, plays a few levels and the
// daily challenge, fails on any page error, and saves screenshots to shots/.
// Usage: python3 -m http.server 8123 & node scripts/smoke.js [url]
const { chromium } = require('playwright');
const fs = require('fs');
const url = process.argv[2] || 'http://localhost:8123/';
const out = 'shots';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.LP = { fastAds: true }; });
  await page.goto(url);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/1-home.png` });

  await page.click('#btn-play');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/2-ready.png` });

  const playOnce = async (shotMid) => {
    const [x, y] = await page.evaluate(() => window.__letup.cluster());
    await page.evaluate(([x, y]) => window.__letup.tapWorld(x, y), [x, y]);
    if (shotMid) { await page.waitForTimeout(650); await page.screenshot({ path: shotMid }); }
    await page.waitForFunction(() => window.__letup.state === 'result' || window.__letup.state === 'ready', null, { timeout: 30000 });
    await page.waitForTimeout(900);
    return page.evaluate(() => ({ state: window.__letup.state, popped: window.__letup.world.popped, target: window.__letup.world.target, total: window.__letup.world.total }));
  };

  let r = await playOnce(`${out}/3-chain.png`);
  console.log('level 1', r);
  await page.screenshot({ path: `${out}/4-result.png` });

  // play several levels; retry on fail
  for (let i = 0; i < 12; i++) {
    const next = await page.$('#r-next');
    const retry = await page.$('#r-retry');
    if (next) await next.click(); else if (retry) await retry.click();
    await page.waitForTimeout(400);
    if (await page.$('.ad-mock')) { await page.waitForSelector('.ad-close:not([disabled])'); await page.click('.ad-close'); await page.waitForTimeout(400); }
    const lvl = await page.evaluate(() => window.__letup.world.cfg.level);
    r = await playOnce(i === 2 ? `${out}/5-chain-l${lvl}.png` : null);
    while (r.state === 'ready') r = await playOnce(null); // boss levels have a second tap
    console.log('level', lvl, r);
    if (r.state === 'result' && r.popped < r.target && i === 3) await page.screenshot({ path: `${out}/6-lose.png` });
  }
  await page.screenshot({ path: `${out}/7-result.png` });

  // home -> daily
  await page.evaluate(() => window.__letup.goHome());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#modal').classList.add('hidden'));
  await page.click('#btn-daily');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/8-daily-sheet.png` });
  await page.click('#d-play');
  await page.waitForTimeout(500);
  r = await playOnce(`${out}/9-daily-chain.png`);
  console.log('daily', r);
  await page.screenshot({ path: `${out}/10-daily-result.png` });
  await page.click('#r-home');
  await page.waitForTimeout(300);
  for (const [btn, name] of [['#btn-missions', '11-missions'], ['#btn-themes', '12-themes'], ['#btn-settings', '13-settings']]) {
    await page.click(btn); await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.click('#sheet [data-close]'); await page.waitForTimeout(200);
  }
  await page.click('#btn-map'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/14-map.png` });
  await page.click('#map-back'); await page.waitForTimeout(300);
  await page.click('#btn-chest', { force: true }); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/15-chest.png` });
  await page.click('#sheet [data-close]'); await page.waitForTimeout(300);
  await page.evaluate(() => { window.LP.profile.login = { last: '', day: 3 }; window.__letup.loginSheet(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/16-login.png` });
  await page.click('#l-claim'); await page.waitForTimeout(300);
  const prof = await page.evaluate(() => window.LP.profile);
  console.log('profile', { level: prof.level, coins: prof.coins, games: prof.games, wins: prof.wins, bestChain: prof.bestChain });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
  process.exitCode = errors.length ? 1 : 0;
})();
