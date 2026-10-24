// Canvas renderer: glowing bubbles, blasts, particles, shockwaves, floating text, shake.
(() => {
  'use strict';
  const LP = (window.LP = window.LP || {});
  const E = LP.Engine;

  let cv, cx, dpr = 1, cw = 0, ch = 0;
  const view = { s: 1, ox: 0, oy: 0, top: 0, bottom: 0 };
  let sprites = {}, themeId = null, theme = null;
  const fx = { parts: [], rings: [], texts: [], shake: 0, flash: 0, flashColor: '#fff', t: 0 };
  const blobs = [0, 1, 2].map((i) => ({ a: i * 2.1, r: 0.55 + i * 0.15 }));

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function makeSprite(color) {
    const S = 96, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const m = S / 2;
    // outer glow
    let gr = g.createRadialGradient(m, m, 10, m, m, m);
    gr.addColorStop(0, hexA(color, 0.55)); gr.addColorStop(0.45, hexA(color, 0.18)); gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // body
    gr = g.createRadialGradient(m - 6, m - 7, 2, m, m, 19);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, hexA(color, 0.75));
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, 18, 0, Math.PI * 2); g.fill();
    // rim + highlight
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.ellipse(m - 6, m - 8, 5, 3, -0.6, 0, Math.PI * 2); g.fill();
    return c;
  }

  function setTheme(t) {
    if (themeId === t.id) return;
    themeId = t.id; theme = t;
    sprites = {};
    t.colors.forEach((c, i) => (sprites[i] = makeSprite(c)));
    sprites.koin = makeSprite('#ffc83d');
    sprites.baja = makeSprite('#c8d3e6');
    sprites.bom = makeSprite('#ff3b3b');
    sprites.es = makeSprite('#bff4ff');
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth; ch = window.innerHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    layout();
  }

  function layout() {
    const top = view.top, bottom = view.bottom;
    const availH = Math.max(100, ch - top - bottom), availW = cw - 16;
    view.s = Math.min(availW / E.W, availH / E.H);
    view.ox = (cw - E.W * view.s) / 2;
    view.oy = top + (availH - E.H * view.s) / 2;
  }

  function colorOf(i) { return i < 0 ? '#ffffff' : theme.colors[i % theme.colors.length]; }

  // ---------- effects API ----------
  function burst(x, y, color, n, speed) {
    if (fx.parts.length > 700) n = Math.min(n, 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, t: 0, color, size: 1.5 + Math.random() * 2.5 });
    }
  }
  function ring(x, y, color, max, width) { fx.rings.push({ x, y, color, max, t: 0, width: width || 3 }); }
  function text(str, opt = {}) {
    // a new centre text replaces the previous one in the same slot instead of stacking
    if (opt.slot) for (let i = fx.texts.length - 1; i >= 0; i--) if (fx.texts[i].slot === opt.slot) fx.texts.splice(i, 1);
    fx.texts.push(Object.assign({ str, x: E.W / 2, y: E.H * 0.38, t: 0, life: 1.1, size: 44, color: '#fff', rise: 40 }, opt));
  }
  function shake(a) { fx.shake = Math.max(fx.shake, a); }
  function flash(a, color) { fx.flash = Math.max(fx.flash, a); fx.flashColor = color || '#fff'; }

  // ---------- drawing ----------
  function drawBg(dt, fever) {
    const g = cx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
    cx.fillStyle = g; cx.fillRect(0, 0, cw, ch);
    cx.globalCompositeOperation = 'lighter';
    blobs.forEach((b, i) => {
      b.a += dt * (0.08 + i * 0.03) * (fever ? 4 : 1);
      const x = cw * (0.5 + 0.35 * Math.cos(b.a)), y = ch * (0.5 + 0.3 * Math.sin(b.a * 1.3));
      const r = Math.max(cw, ch) * b.r * 0.6;
      const gr = cx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, hexA(theme.colors[i * 2 % theme.colors.length], fever ? 0.2 : 0.09));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = gr; cx.fillRect(0, 0, cw, ch);
    });
    cx.globalCompositeOperation = 'source-over';
  }

  function drawFrame() {
    cx.save();
    cx.strokeStyle = 'rgba(255,255,255,0.09)'; cx.lineWidth = 2 / view.s;
    const r = 18;
    cx.beginPath();
    if (cx.roundRect) cx.roundRect(0, 0, E.W, E.H, r); else cx.rect(0, 0, E.W, E.H);
    cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.025)'; cx.fill();
    cx.restore();
  }

  function drawIcon(b, R) {
    cx.save();
    cx.translate(b.x, b.y);
    cx.lineCap = 'round';
    switch (b.type) {
      case 'bom':
        cx.fillStyle = '#2a0610'; cx.beginPath(); cx.arc(0, 1, R * 0.5, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#ffd23f'; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(R * 0.25, -R * 0.35); cx.quadraticCurveTo(R * 0.6, -R * 0.9, R * 0.15, -R * 1.05); cx.stroke();
        cx.fillStyle = (fx.t * 8) % 2 < 1 ? '#fff' : '#ffd23f'; cx.beginPath(); cx.arc(R * 0.15, -R * 1.05, 1.8, 0, Math.PI * 2); cx.fill();
        break;
      case 'belah':
        cx.fillStyle = '#fff';
        for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; cx.beginPath(); cx.arc(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45, 1.9, 0, Math.PI * 2); cx.fill(); }
        cx.beginPath(); cx.arc(0, 0, 1.6, 0, Math.PI * 2); cx.fill();
        break;
      case 'es':
        cx.strokeStyle = '#1b6b8a'; cx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; cx.beginPath(); cx.moveTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6); cx.lineTo(-Math.cos(a) * R * 0.6, -Math.sin(a) * R * 0.6); cx.stroke(); }
        break;
      case 'koin':
        cx.fillStyle = '#8a5a00';
        cx.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.25 : R * 0.6; cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        cx.closePath(); cx.fill();
        break;
      case 'baja':
        cx.strokeStyle = '#5b6b85'; cx.lineWidth = 2.4;
        cx.beginPath(); cx.arc(0, 0, R * 0.62, 0, Math.PI * 2); cx.stroke();
        if (b.cracked) {
          cx.strokeStyle = '#1d2433'; cx.lineWidth = 1.4;
          cx.beginPath(); cx.moveTo(-R * 0.5, -R * 0.4); cx.lineTo(-R * 0.05, 0); cx.lineTo(-R * 0.2, R * 0.2); cx.lineTo(R * 0.45, R * 0.5); cx.stroke();
        }
        break;
    }
    cx.restore();
  }

  function drawWorld(w, dt) {
    const frozen = w.freeze > 0;
    // blasts first, additive
    cx.globalCompositeOperation = 'lighter';
    for (const bl of w.blasts) {
      if (bl.r <= 0.5) continue;
      const c = colorOf(bl.color);
      const fade = bl.t > E.LIFE - 0.35 ? 0.6 : 1;
      cx.fillStyle = hexA(c, (bl.small ? 0.32 : 0.2) * fade);
      cx.beginPath(); cx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = hexA(c, 0.75 * fade); cx.lineWidth = 2;
      cx.stroke();
      cx.fillStyle = hexA(c, 0.25 * fade);
      cx.beginPath(); cx.arc(bl.x, bl.y, bl.r * 0.45, 0, Math.PI * 2); cx.fill();
    }
    cx.globalCompositeOperation = 'source-over';

    for (const b of w.bubbles) {
      if (!b.alive) continue;
      const pulse = 1 + 0.06 * Math.sin(fx.t * 3 + b.phase);
      const R = b.r * 1.2 * pulse;
      const spr = sprites[b.type === 'normal' || b.type === 'belah' ? b.color : b.type] || sprites[0];
      const S = R * (96 / 36) * 2;
      cx.globalAlpha = b.immune > 0 ? 0.6 : 1;
      cx.drawImage(spr, b.x - S / 2, b.y - S / 2, S, S);
      cx.globalAlpha = 1;
      if (b.type !== 'normal') drawIcon(b, R);
      if (frozen) { cx.strokeStyle = 'rgba(190,240,255,0.7)'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(b.x, b.y, R + 2, 0, Math.PI * 2); cx.stroke(); }
    }
  }

  function drawFx(dt) {
    cx.globalCompositeOperation = 'lighter';
    for (let i = fx.rings.length - 1; i >= 0; i--) {
      const r = fx.rings[i];
      r.t += dt;
      const p = r.t / 0.5;
      if (p >= 1) { fx.rings.splice(i, 1); continue; }
      cx.strokeStyle = hexA(r.color, (1 - p) * 0.9);
      cx.lineWidth = r.width * (1 - p) + 0.5;
      cx.beginPath(); cx.arc(r.x, r.y, r.max * (1 - (1 - p) * (1 - p)), 0, Math.PI * 2); cx.stroke();
    }
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const q = fx.parts[i];
      q.t += dt;
      if (q.t >= q.life) { fx.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.96; q.vy = q.vy * 0.96 + 30 * dt;
      cx.fillStyle = hexA(q.color, 1 - q.t / q.life);
      cx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    cx.globalCompositeOperation = 'source-over';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (let i = fx.texts.length - 1; i >= 0; i--) {
      const t = fx.texts[i];
      t.t += dt;
      const p = t.t / t.life;
      if (p >= 1) { fx.texts.splice(i, 1); continue; }
      const pop = p < 0.15 ? 0.5 + (p / 0.15) * 0.7 : p < 0.25 ? 1.2 - ((p - 0.15) / 0.1) * 0.2 : 1;
      cx.save();
      cx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      cx.translate(t.x, t.y - p * t.rise);
      cx.scale(pop, pop);
      cx.font = `700 ${t.size}px Fredoka, system-ui, sans-serif`;
      cx.lineWidth = t.size / 7; cx.strokeStyle = 'rgba(0,0,0,0.55)'; cx.lineJoin = 'round';
      cx.strokeText(t.str, 0, 0);
      cx.fillStyle = t.color;
      cx.fillText(t.str, 0, 0);
      cx.restore();
    }
  }

  function drawChain(w) {
    if (!w || w.chain < 2 || (!w.active && fx.t - (w._endT || 0) > 1.2)) return;
    if (!w.active && !w._endT) w._endT = fx.t;
    if (w.active) w._endT = 0;
    const s = 1 + Math.min(w.chain, 60) / 60;
    cx.save();
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.font = `700 ${Math.round(26 * s)}px Fredoka, system-ui, sans-serif`;
    cx.fillStyle = w.fever ? '#ffd23f' : 'rgba(255,255,255,0.92)';
    cx.lineWidth = 5; cx.strokeStyle = 'rgba(0,0,0,0.45)'; cx.lineJoin = 'round';
    const str = 'x' + w.chain;
    cx.strokeText(str, E.W / 2, 34 * s);
    cx.fillText(str, E.W / 2, 34 * s);
    cx.restore();
  }

  LP.Render = {
    view, fx, burst, ring, text, shake, flash, colorOf,
    init(canvas) {
      cv = canvas; cx = cv.getContext('2d');
      window.addEventListener('resize', resize);
      resize();
    },
    setInsets(top, bottom) { view.top = top; view.bottom = bottom; layout(); },
    setTheme,
    toWorld(clientX, clientY) { return { x: (clientX - view.ox) / view.s, y: (clientY - view.oy) / view.s }; },
    toScreen(x, y) { return { x: view.ox + x * view.s, y: view.oy + y * view.s }; },
    frame(w, dt, opts = {}) {
      fx.t += dt;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBg(dt, w && w.fever && w.active);
      let sx = 0, sy = 0;
      if (fx.shake > 0) {
        sx = (Math.random() - 0.5) * fx.shake; sy = (Math.random() - 0.5) * fx.shake;
        fx.shake = Math.max(0, fx.shake - dt * 40);
      }
      cx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * (view.ox + sx), dpr * (view.oy + sy));
      if (!opts.noFrame) drawFrame();
      if (w) { cx.globalAlpha = opts.dim || 1; drawWorld(w, dt); cx.globalAlpha = 1; }
      drawFx(dt);
      if (w && !opts.noChain) drawChain(w);
      if (fx.flash > 0) {
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx.fillStyle = hexA(fx.flashColor, Math.min(0.6, fx.flash));
        cx.fillRect(0, 0, cw, ch);
        fx.flash = Math.max(0, fx.flash - dt * 2.5);
      }
    },
    clearFx() { fx.parts.length = 0; fx.rings.length = 0; fx.texts.length = 0; fx.shake = 0; fx.flash = 0; },
  };
})();
