// Ad layer. Every ad in the game goes through LP.Ads, so a real SDK (AdMob through
// Capacitor) only has to set LP.nativeAdProvider = { showRewarded, showInterstitial }.
//
// Placements:
//   rewarded:      extra_tap, double_coins, super_blast, daily_try, mission_double, free_coins
//   interstitial:  level_end (only between levels, frequency-capped)
(() => {
  'use strict';
  const LP = (window.LP = window.LP || {});

  const POLICY = {
    firstInterstitialAfterLevels: 6, // new players see none in their first 6 level results
    levelsBetweenInterstitials: 3,   // at most every 3rd level result
    minSecondsBetweenAds: 90,        // and never within 90s of any other ad
  };
  const state = { lastAdAt: 0, sinceInterstitial: 0 };

  // Mock provider: a fake full-screen ad so the flows can be tested on the web.
  function mockAd(kind, placement) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'ad-mock';
      const secs = kind === 'rewarded' ? 4 : 3;
      el.innerHTML = `
        <div class="ad-box">
          <div class="ad-tag">IKLAN CONTOH</div>
          <div class="ad-title">${kind === 'rewarded' ? 'Iklan berhadiah' : 'Iklan'}</div>
          <div class="ad-sub">placement: <b>${placement}</b></div>
          <div class="ad-ring"><span>${secs}</span></div>
          <p class="ad-note">Di versi aplikasi, di sini tampil iklan asli.</p>
          <button class="btn ad-close" disabled>Tunggu...</button>
        </div>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      const btn = el.querySelector('.ad-close');
      const num = el.querySelector('.ad-ring span');
      let left = secs;
      const iv = setInterval(() => {
        left--;
        num.textContent = Math.max(0, left);
        if (left > 0) return;
        clearInterval(iv);
        btn.disabled = false;
        btn.textContent = kind === 'rewarded' ? 'Ambil hadiah' : 'Tutup';
      }, LP.fastAds ? 60 : 1000);
      btn.addEventListener('click', () => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 200);
        resolve(true);
      });
    });
  }

  function provider() {
    return LP.nativeAdProvider || {
      showRewarded: (p) => mockAd('rewarded', p),
      showInterstitial: (p) => mockAd('interstitial', p),
    };
  }

  async function run(kind, placement) {
    LP.track('ad_request', { kind, placement });
    LP.Sfx && LP.Sfx.duck(true);
    let ok = false;
    try {
      ok = kind === 'rewarded' ? await provider().showRewarded(placement) : await provider().showInterstitial(placement);
    } catch (e) { ok = false; }
    LP.Sfx && LP.Sfx.duck(false);
    state.lastAdAt = Date.now();
    LP.track(ok ? 'ad_complete' : 'ad_failed', { kind, placement });
    return ok;
  }

  LP.Ads = {
    POLICY,
    rewarded: (placement) => run('rewarded', placement),
    levelFinished() { state.sinceInterstitial++; },
    canInterstitial() {
      const p = LP.profile;
      if (p.noAds) return false;
      if (p.games < POLICY.firstInterstitialAfterLevels) return false;
      if (state.sinceInterstitial < POLICY.levelsBetweenInterstitials) return false;
      if (Date.now() - state.lastAdAt < POLICY.minSecondsBetweenAds * 1000) return false;
      return true;
    },
    async maybeInterstitial(placement) {
      if (!this.canInterstitial()) return false;
      state.sinceInterstitial = 0;
      return run('interstitial', placement);
    },
  };
})();
