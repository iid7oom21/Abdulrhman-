(() => {
  'use strict';

  const root = document.documentElement;
  const intro = document.getElementById('rvnStudioIntro');
  const video = document.getElementById('rvnStudioIntroVideo');
  const skip = document.getElementById('rvnIntroSkip');
  const nav = document.querySelector('.ravenNav');
  const key = 'raven_studio_ident_v1';
  const timers = new Set();
  let closing = false;

  // The head bootstrap owns the independent deadline. Keep a fallback for an
  // older cached HTML response, without depending on this asset for fail-open.
  const lifecycle = window.ravenIntro || (window.ravenIntro = {
    complete: false,
    finish(reason) {
      if (this.complete) return;
      this.complete = true;
      this.reason = reason;
      if (reason !== 'repeat-session') {
        try { sessionStorage.setItem(key, '1'); } catch (_) {}
      }
      root.classList.remove('rvn-intro-pending');
      if (video) { try { video.pause(); } catch (_) {} }
      if (intro) { intro.hidden = true; intro.remove(); }
      document.dispatchEvent(new CustomEvent('raven:intro-complete', {
        detail: { reason }
      }));
    }
  });

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!lifecycle.complete) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function cleanUp() {
    timers.forEach(clearTimeout);
    timers.clear();
    if (skip) skip.removeEventListener('click', onSkip);
    if (video) {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      try { video.pause(); } catch (_) {}
    }
    if (intro) intro.removeEventListener('transitionend', onTransitionEnd);
    document.removeEventListener('raven:intro-complete', cleanUp);
  }

  function finish(reason) {
    if (lifecycle.complete) { cleanUp(); return; }
    lifecycle.finish(reason);
    cleanUp();
  }

  let exitReason = 'ended';
  function closeIntro(reason, immediate = false) {
    if (closing || lifecycle.complete) return;
    closing = true;
    exitReason = reason;
    if (video) { try { video.pause(); } catch (_) {} }
    if (!intro || immediate) { finish(reason); return; }

    // CSS alone owns the intro scroll lock. Removing this class preserves any
    // inline overflow owned by the page or an open player. The exit selector
    // keeps the overlay displayed while the underlying homepage is revealed.
    intro.classList.add('is-exiting');
    root.classList.remove('rvn-intro-pending');
    intro.addEventListener('transitionend', onTransitionEnd);
    later(() => finish(reason), 680);
  }

  function onTransitionEnd(event) {
    if (event.target === intro && event.propertyName === 'opacity') finish(exitReason);
  }
  function onEnded() { closeIntro('ended'); }
  function onSkip() { closeIntro('skip'); }
  function onError() { later(() => closeIntro('media-error'), 400); }

  document.addEventListener('raven:intro-complete', cleanUp);

  if (lifecycle.complete) {
    // A bootstrap deadline can fire before this deferred asset arrives.
    if (intro) { intro.hidden = true; intro.remove(); }
    root.classList.remove('rvn-intro-pending');
    cleanUp();
  } else if (!intro || !root.classList.contains('rvn-intro-pending')) {
    finish(intro ? 'repeat-session' : 'missing-intro');
  } else if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    closeIntro('reduced-motion', true);
  } else {
    intro.hidden = false;
    if(skip)skip.tabIndex=-1;
    later(() => {intro.classList.add('can-skip');if(skip)skip.tabIndex=0;}, 900);
    if (skip) skip.addEventListener('click', onSkip);
    // This is a second guard for older HTML. The head bootstrap deadline can
    // still finish sooner if network loading delayed this script.
    later(() => finish('timeout'), 9500);

    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      try {
        const playback = video.play();
        if (playback && typeof playback.catch === 'function') {
          playback.catch(() => {
            if (!closing && !lifecycle.complete) later(() => closeIntro('autoplay-blocked'), 1800);
          });
        }
      } catch (_) {
        later(() => closeIntro('playback-error'), 400);
      }
    } else {
      later(() => closeIntro('missing-video'), 1400);
    }
  }

  let scrollFrame = 0;
  function scrollUI() {
    scrollFrame = 0;
    const max = Math.max(1, root.scrollHeight - window.innerHeight);
    const top = window.scrollY || 0;
    const percent = Math.max(0, Math.min(100, (top / max) * 100));
    root.style.setProperty('--rvn-scroll', percent + '%');
    if (nav) nav.classList.toggle('rvn-scrolled', top > 26);
  }
  function queueScrollUI() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(scrollUI);
  }
  scrollUI();
  window.addEventListener('scroll', queueScrollUI, { passive: true });
  window.addEventListener('resize', queueScrollUI, { passive: true });
})();
