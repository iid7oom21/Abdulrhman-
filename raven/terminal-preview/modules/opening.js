import { el } from './core.js?v=abc27e4aad89ec10';

const VIDEO = new URL('../assets/raven-intro.mp4', import.meta.url).href;
const POSTER = new URL('../assets/raven-intro-poster.jpg', import.meta.url).href;

// This scene owns no saved state. The existing audio owner keeps its preferences.
export function createOpening(services) {
  let current = null;

  function show({ automatic = false } = {}) {
    if (current || (automatic && !services.motionAllowed())) return;
    const { t, audio } = services;
    const returnFocus = automatic ? null : document.activeElement;
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const video = el('video', {
      id: 'raven-opening-video', class: 'opening-video', poster: POSTER,
      playsinline: true, muted: true, preload: 'auto',
      'aria-label': t('افتتاحية رايفن: من الأرشيف إلى شعار RAVEN', 'RAVEN opening: from the archive to the RAVEN title'),
    });
    video.muted = true;
    video.defaultMuted = true;
    const status = el('p', { class: 'opening-status', role: 'status', text: t('جارٍ تشغيل الافتتاحية…', 'Loading the opening…') });
    const pause = el('button', { type: 'button', class: 'opening-control', text: t('إيقاف مؤقت', 'Pause') });
    const sound = el('button', { type: 'button', class: 'opening-control', text: t('تشغيل الصوت', 'Enable sound'), 'aria-pressed': 'false' });
    const start = el('button', { type: 'button', class: 'button primary opening-start', hidden: true, text: t('تشغيل الافتتاحية', 'Play opening') });
    const progress = el('progress', { class: 'opening-progress', max: 1, value: 0, 'aria-label': t('تقدم الافتتاحية', 'Opening progress') });
    const skip = el('button', { type: 'button', class: 'opening-control opening-skip', text: t('تخطي الافتتاحية', 'Skip opening') });
    const dialog = el('dialog', { class: 'opening-dialog', 'aria-labelledby': 'opening-title' }, [
      el('header', { class: 'opening-header' }, [
        el('div', {}, [el('h2', { id: 'opening-title', class: 'opening-brand', text: 'RAVEN', dir: 'ltr' }),
          el('p', { class: 'opening-caption', text: t('كل حكاية تترك أثرًا', 'Every story leaves a trace') })]), skip,
      ]),
      el('div', { class: 'opening-stage' }, [video, start]),
      el('footer', { class: 'opening-footer' }, [progress,
        el('div', { class: 'opening-controls' }, [pause, sound]), status,
      ]),
    ]);
    let loadTimer;
    let failed = false;
    const session = { dialog, close };
    current = session;

    function isActive() { return current === session; }

    function close({ focus = true } = {}) {
      if (!isActive()) return;
      current = null;
      clearTimeout(loadTimer);
      lifetime.abort();
      video.pause();
      video.removeAttribute('src');
      video.load();
      dialog.close();
      dialog.remove();
      audio.release('opening');
      if (focus) requestAnimationFrame(() => {
        if (current) return;
        const target = returnFocus?.isConnected ? returnFocus
          : document.querySelector('#route-outlet h1') || document.querySelector('#route-outlet');
        if (target) { if (!target.matches('button, a, input')) target.tabIndex = -1; target.focus({ preventScroll: true }); }
      });
    }

    async function play() {
      if (!isActive() || failed) return;
      start.hidden = true;
      try {
        await video.play();
        if (!isActive()) video.pause();
      } catch (error) {
        if (!isActive() || error?.name === 'AbortError' || failed) return;
        clearTimeout(loadTimer);
        start.hidden = false;
        pause.textContent = t('متابعة الافتتاحية', 'Resume opening');
        status.textContent = t('اضغط تشغيل للمشاهدة، أو تخطَّ إلى الموقع.', 'Press play to watch, or skip to the site.');
      }
    }

    skip.addEventListener('click', () => close(), { signal });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }, { signal });
    start.addEventListener('click', play, { signal });
    pause.addEventListener('click', () => { if (video.paused) void play(); else video.pause(); }, { signal });
    sound.addEventListener('click', () => {
      video.muted = !video.muted;
      sound.textContent = video.muted ? t('تشغيل الصوت', 'Enable sound') : t('كتم الصوت', 'Mute sound');
      sound.setAttribute('aria-pressed', String(!video.muted));
    }, { signal });
    video.addEventListener('playing', () => {
      clearTimeout(loadTimer);
      start.hidden = true;
      status.textContent = '';
      pause.textContent = t('إيقاف مؤقت', 'Pause');
    }, { signal });
    video.addEventListener('pause', () => { pause.textContent = t('متابعة الافتتاحية', 'Resume opening'); }, { signal });
    video.addEventListener('timeupdate', () => {
      if (Number.isFinite(video.duration) && video.duration > 0) progress.value = video.currentTime / video.duration;
    }, { signal });
    video.addEventListener('ended', () => close(), { signal });
    video.addEventListener('error', () => {
      failed = true;
      clearTimeout(loadTimer);
      pause.disabled = true;
      sound.disabled = true;
      start.hidden = true;
      status.textContent = t('تعذّر تشغيل الفيديو. تقدر تتخطى الافتتاحية وتكمل.', 'The video could not play. Skip the opening to continue.');
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !video.paused) video.pause();
    }, { signal });
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
      if (event.matches) video.pause();
    }, { signal });

    audio.hold('opening');
    document.querySelectorAll('video[data-ambient-video]').forEach(item => item.pause());
    document.body.append(dialog);
    dialog.showModal();
    skip.focus({ preventScroll: true });
    video.src = VIDEO;
    loadTimer = setTimeout(() => {
      if (isActive() && video.readyState < 3) status.textContent = t('التحميل يأخذ وقتًا. تقدر تتخطى الافتتاحية الآن.', 'Loading is taking a moment. You can skip the opening now.');
    }, 8000);
    void play();
  }

  return { show, hide: options => current?.close(options), get active() { return Boolean(current); } };
}
