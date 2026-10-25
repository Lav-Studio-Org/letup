// Shared helpers for the balance scripts: play one attempt of a board headlessly.
const E = require('../js/engine.js');
const DT = 1 / 120;

// aim=true approximates a player who looks for a cluster: best of 12 spots by bubbles in reach.
function pick(w, rng, aim) {
  let best = null, bestN = -1;
  for (let k = 0; k < (aim ? 12 : 1); k++) {
    const x = rng() * E.W, y = rng() * E.H;
    let n = 0;
    for (const b of w.bubbles) if (b.alive && (b.x - x) ** 2 + (b.y - y) ** 2 < (E.BLAST_R * 1.1) ** 2) n += b.type === 'bos' ? 3 : 1;
    if (n > bestN) { bestN = n; best = [x, y]; }
  }
  return best;
}

// Plays every tap the board allows (boss levels have two), each after a random wait.
function attempt(cfg, rng, aim) {
  const w = E.createWorld(cfg);
  let nextTap = 0.3 + rng() * 3;
  for (let t = 0; t < 60; t += DT) {
    if (!w.active && w.tapsLeft > 0 && t >= nextTap) E.tap(w, ...pick(w, rng, aim));
    E.step(w, DT);
    for (const ev of w.events) if (ev.type === 'chainEnd') nextTap = t + 0.3 + rng() * 1.5;
    w.events.length = 0;
    if (!w.active && w.tapsLeft === 0 && w.tapsUsed > 0) break;
    if (E.won(w) && w.cfg.boss && !w.active) break;
  }
  return w;
}

module.exports = { E, attempt };
