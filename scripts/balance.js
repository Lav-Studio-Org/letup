// Monte Carlo check that every level is beatable: random taps at random moments.
// Usage: node scripts/balance.js [fromLevel] [toLevel] [triesPerLevel]
const E = require('../js/engine.js');
const [from = 1, to = 40, tries = 300] = process.argv.slice(2).map(Number);
const DT = 1 / 120;

// aim=true approximates a player who looks for a cluster: best of 12 spots by bubbles in reach.
function pick(w, rng, aim) {
  let best = null, bestN = -1;
  for (let k = 0; k < (aim ? 12 : 1); k++) {
    const x = rng() * E.W, y = rng() * E.H;
    let n = 0;
    for (const b of w.bubbles) if ((b.x - x) ** 2 + (b.y - y) ** 2 < (E.BLAST_R * 1.1) ** 2) n++;
    if (n > bestN) { bestN = n; best = [x, y]; }
  }
  return best;
}

function attempt(cfg, rng, aim) {
  const w = E.createWorld(cfg);
  const tapAt = 0.3 + rng() * 3;
  let tapped = false;
  for (let t = 0; t < 30; t += DT) {
    if (!tapped && t >= tapAt) { E.tap(w, ...pick(w, rng, aim)); tapped = true; }
    E.step(w, DT);
    w.events.length = 0;
    if (tapped && !w.active) break;
  }
  return w;
}

let bad = 0;
for (let L = from; L <= to; L++) {
  const cfg = L === 0 ? E.dailyConfig('2026-10-24') : E.levelConfig(L);
  const rng = E.mulberry32(L * 7919);
  let win = 0, aimWin = 0, sum = 0, best = 0;
  for (let i = 0; i < tries; i++) {
    const w = attempt(cfg, rng, false);
    if (w.popped >= cfg.target) win++;
    if (attempt(cfg, rng, true).popped >= cfg.target) aimWin++;
    sum += w.popped; best = Math.max(best, w.popped);
  }
  const p = win / tries, pa = aimWin / tries;
  const p20 = 1 - Math.pow(1 - pa, 10);
  const flag = pa < 0.12 ? '  <-- too hard' : pa > 0.97 && L > 4 && cfg.kind !== 'bonus' ? '  <-- too easy' : '';
  if (flag) bad++;
  console.log(`L${String(L).padStart(3)} ${cfg.kind.padEnd(6)} ${String(cfg.target).padStart(2)}/${String(cfg.n).padEnd(2)} random ${(p * 100).toFixed(0).padStart(3)}%  aimed ${(pa * 100).toFixed(0).padStart(3)}%  10 aimed tries ${(p20 * 100).toFixed(0).padStart(3)}%  avg ${(sum / tries).toFixed(1)} best ${best}${flag}`);
}
process.exitCode = bad ? 1 : 0;
