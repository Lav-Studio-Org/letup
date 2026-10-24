// Shared helpers for the balance scripts: play one attempt of a board headlessly.
const E = require('../js/engine.js');
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

module.exports = { E, attempt };
