// Synthesized sound: every pop is a note, so a chain plays a rising melody.
// Each theme has its own musical scale and timbre. No audio files.
(() => {
  'use strict';
  const LP = (window.LP = window.LP || {});

  const SCALES = {
    neon:    { notes: [0, 2, 4, 7, 9], root: 261.63, wave: 'triangle' },     // C major pentatonic
    permen:  { notes: [0, 2, 4, 7, 9], root: 329.63, wave: 'sine' },         // E major pentatonic, sweet
    laut:    { notes: [0, 3, 5, 7, 10], root: 293.66, wave: 'sine' },        // D minor pentatonic
    galaksi: { notes: [0, 2, 3, 7, 8], root: 220.0, wave: 'triangle' },      // A hirajoshi
    api:     { notes: [0, 3, 5, 6, 7, 10], root: 261.63, wave: 'sawtooth' }, // C blues
  };

  let ctx = null, master = null, sfxBus = null, musicBus = null, wet = null;
  let scale = SCALES.neon;
  // End times of scheduled voices. Counting by time (not onended) can never get stuck,
  // even if the context was suspended while notes were queued.
  let voiceEnds = [], lastNoteAt = 0, notesInWindow = 0;
  let musicTimer = null, musicStep = 0;
  const settings = { sound: true, music: true };

  function ensure() {
    if (ctx && ctx.state !== 'closed') return ctx;
    ctx = null; voiceEnds = [];
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);

    // small generated reverb gives the pops a sense of space
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = 0.32;
    wet.connect(conv).connect(master);
    applySettings();
    return ctx;
  }

  function applySettings() {
    if (!ctx) return;
    sfxBus.gain.value = settings.sound ? 1 : 0;
    wet.gain.value = settings.sound ? 0.32 : 0;
    musicBus.gain.value = settings.music ? 0.55 : 0;
  }

  function out(pan) {
    const g = ctx.createGain();
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-0.8, Math.min(0.8, pan || 0));
      g.connect(p); p.connect(sfxBus); p.connect(wet);
    } else { g.connect(sfxBus); g.connect(wet); }
    return g;
  }

  function tone({ f, f0, type = 'sine', t = 0, a = 0.005, d = 0.3, vol = 0.2, pan = 0 }) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0 || f, now);
    if (f0) o.frequency.exponentialRampToValueAtTime(f, now + 0.045);
    const g = out(pan);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + a + d);
    o.connect(g);
    o.start(now); o.stop(now + a + d + 0.05);
    voiceEnds.push(now + a + d + 0.05);
    o.onended = () => g.disconnect();
  }

  function noteFreq(i) {
    const n = scale.notes.length;
    // climb up to ~2.4 octaves, then keep cycling the top octave
    const maxIdx = n * 2 + 2;
    const k = i <= maxIdx ? i : maxIdx - n + ((i - maxIdx) % n);
    const semi = scale.notes[k % n] + 12 * Math.floor(k / n);
    return scale.root * Math.pow(2, semi / 12);
  }

  function busyVoices() {
    const t = ctx.currentTime;
    if (voiceEnds.length > 64) voiceEnds = voiceEnds.filter((e) => e > t);
    let n = 0;
    for (const e of voiceEnds) if (e > t) n++;
    return n;
  }

  // Only schedule sound while the context is actually running. A suspended or
  // interrupted context (autoplay policy, tab switch, iOS after a call or an ad)
  // would otherwise pile up silent notes; instead we try to wake it.
  function ok() {
    if (!settings.sound || !ensure()) return false;
    if (ctx.state !== 'running') { resume(); return false; }
    return true;
  }

  function resume() {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    try { const pr = ctx.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* ignore */ }
  }

  // iOS only unlocks audio from inside a user gesture, and sometimes needs a sound to
  // actually start in that gesture, so play one silent sample too.
  function unlock() {
    if (!ensure()) return;
    resume();
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch (e) { /* ignore */ }
    if (master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(ducked ? 0 : 0.9, ctx.currentTime); }
  }
  let ducked = false;

  LP.Sfx = {
    SCALES,
    settings,
    unlock,
    set(key, val) { settings[key] = val; applySettings(); if (key === 'music') val ? this.musicStart() : this.musicStop(); },
    setTheme(id) { scale = SCALES[id] || SCALES.neon; },

    // chain index -> note of the theme scale; x in 0..1 pans the sound
    pop(chain, x, kind) {
      if (!ok()) return;
      const now = performance.now();
      if (now - lastNoteAt > 35) { lastNoteAt = now; notesInWindow = 0; }
      if (++notesInWindow > 3 || busyVoices() > 40) return;
      const f = noteFreq(Math.max(0, chain - 1));
      const pan = (x - 0.5) * 1.4;
      const vol = Math.min(0.2, 0.12 + chain * 0.004);
      tone({ f, f0: f * 1.6, type: scale.wave, d: 0.42, vol: scale.wave === 'sawtooth' ? vol * 0.45 : vol, pan });
      tone({ f: f * 2, d: 0.14, vol: vol * 0.35, pan });
      if (kind === 'bom') tone({ f: 70, f0: 180, type: 'sine', d: 0.5, vol: 0.35, pan });
      if (kind === 'koin') { tone({ f: 1567, d: 0.12, vol: 0.12, pan }); tone({ f: 2093, t: 0.07, d: 0.25, vol: 0.12, pan }); }
      if (kind === 'es') tone({ f: 2637, f0: 3520, type: 'sine', d: 0.6, vol: 0.06, pan });
    },
    crack(x) { if (ok()) tone({ f: 900, f0: 1400, type: 'square', d: 0.06, vol: 0.05, pan: (x - 0.5) * 1.4 }); },
    tap(x) { if (ok()) { tone({ f: 90, f0: 220, type: 'sine', d: 0.25, vol: 0.4, pan: (x - 0.5) }); } },
    fever() {
      if (!ok()) return;
      [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => tone({ f: noteFreq(5 + i), type: 'triangle', t: i * 0.045, d: 0.25, vol: 0.09 }));
    },
    milestone(chain) {
      if (!ok()) return;
      const base = 5 + Math.min(chain, 40) / 5;
      [0, 2, 4].forEach((i, j) => tone({ f: noteFreq(base + i), type: 'sine', t: j * 0.06, d: 0.5, vol: 0.1 }));
    },
    win(perfect) {
      if (!ok()) return;
      const seq = perfect ? [0, 2, 4, 5, 7, 9, 10] : [0, 2, 4, 7];
      seq.forEach((i, j) => tone({ f: noteFreq(5 + i), type: 'triangle', t: j * 0.09, d: 0.6, vol: 0.13 }));
    },
    lose() {
      if (!ok()) return;
      tone({ f: noteFreq(4), type: 'sine', d: 0.35, vol: 0.12 });
      tone({ f: noteFreq(2), type: 'sine', t: 0.18, d: 0.55, vol: 0.12 });
    },
    coin() { if (ok()) { tone({ f: 1318, d: 0.1, vol: 0.1 }); tone({ f: 1976, t: 0.06, d: 0.3, vol: 0.1 }); } },
    click() { if (ok()) tone({ f: 660, f0: 900, type: 'sine', d: 0.07, vol: 0.08 }); },
    star(i) { if (ok()) tone({ f: noteFreq(7 + i * 2), type: 'triangle', d: 0.4, vol: 0.13 }); },

    get _ctx() { return ctx; },
    _debug() { return { state: ctx && ctx.state, voices: ctx ? busyVoices() : 0, gain: master && master.gain.value }; },
    duck(on) {
      ducked = on;
      if (!master) return;
      const g = master.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(on ? 0 : 0.9, t + 0.08);
      if (!on) resume();
    },

    // gentle generative pad in the theme's key
    musicStart() {
      if (musicTimer || !settings.music || !ensure()) return;
      const chords = [[0, 2, 4], [3, 0, 2], [1, 3, 0], [2, 4, 1]];
      const play = () => {
        if (!settings.music || !ctx || ctx.state !== 'running') return;
        const ch = chords[musicStep++ % chords.length];
        const now = ctx.currentTime;
        for (const deg of ch) {
          const f = noteFreq(deg) / 2;
          for (const det of [-6, 6]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.linearRampToValueAtTime(0.016, now + 1.6);
            g.gain.linearRampToValueAtTime(0.0001, now + 5.6);
            o.connect(lp).connect(g).connect(musicBus);
            o.start(now); o.stop(now + 5.8);
          }
        }
      };
      play();
      musicTimer = setInterval(play, 4000);
    },
    musicStop() { clearInterval(musicTimer); musicTimer = null; },
  };

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { try { ctx.suspend(); } catch (e) { /* ignore */ } } else resume();
  });
  window.addEventListener('pageshow', resume);
  window.addEventListener('focus', resume);
  // Any gesture anywhere wakes the audio again (some browsers only accept touchend/click).
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
    document.addEventListener(ev, () => { if (!ctx || ctx.state !== 'running') unlock(); }, { capture: true, passive: true });
  }
})();
