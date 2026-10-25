// Verifies the shipped balance: chance that one aimed attempt earns 1/2/3 stars, per chapter.
// Usage: node scripts/audit-stars.js [tries]
const { E, attempt } = require('./sim.js');
const T = Number(process.argv[2] || 120);
const out = [];
for (let c = 1; c <= E.MAX_LEVEL / E.CHAPTER_SIZE; c++) {
  const acc = [0, 0, 0];
  for (let L = (c - 1) * 10 + 1; L <= c * 10; L++) {
    const cfg = E.levelConfig(L), rng = E.mulberry32(L * 7777 + 1);
    for (let i = 0; i < T; i++) { const st = E.stars(attempt(cfg, rng, true)); for (let k = 0; k < 3; k++) if (st > k) acc[k]++; }
  }
  const f = acc.map((a) => Math.round((100 * a) / (T * 10)));
  out.push({ chapter: c, one: f[0], two: f[1], three: f[2] });
  console.log(`Bab ${String(c).padStart(2)}  1* ${f[0]}%  2* ${f[1]}%  3* ${f[2]}%`);
}
if (process.argv[3]) require('fs').writeFileSync(process.argv[3], JSON.stringify(out));
