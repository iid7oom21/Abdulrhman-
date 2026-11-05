// The preview owns exactly one soundtrack element. It survives route changes.
// The URL is assigned only after a trusted interaction; no media is prefetched.
const SONG_URL = new URL('../../../fourth-signature/assets/audio/raven-baqi-athar-320.mp3', import.meta.url).href;
const clamp = (value, fallback = .65) => Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;

function node(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'text') element.textContent = value;
    else if (key === 'class') element.className = value;
    else element.setAttribute(key, String(value));
  }
  for (const child of [children].flat()) if (child != null) element.append(child);
  return element;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', {
    play: 'M8 5v14l11-7z',
    pause: 'M7 5h4v14H7zM14 5h4v14h-4z',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    close: 'm6 6 12 12M18 6 6 18',
  }[name]);
  path.setAttribute('fill', name === 'play' || name === 'pause' ? 'currentColor' : 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

export function createAudio(dockRoot, services) {
  const { store } = services;
  const t = (ar, en) => services.t ? services.t(ar, en) : ar;
  const lifetime = new AbortController();
  const signal = lifetime.signal;
  const holds = new Set();
  const ducks = new Map();
  const videos = new Map();
  let desired = store.get('musicEnabled', true) !== false;
  let volume = clamp(store.get('musicVolume', .65));
  let ambientDesired = store.get('ambientEnabled', false) === true;
  let armed = false;
  let destroyed = false;
  let waiting = false;
  let blocked = false;
  let mediaError = false;
  let playAttempt = 0;
  let videoIndex = 0;
  let context = null;
  let noise = null;
  let hum = null;
  let roomGain = null;
  let ambientFailed = false;
  let lastTyping = 0;
  let ambientRequest = 0;
  const temporaryTimers = new Set();

  const element = node('audio', { id: 'preview-soundtrack', preload: 'none', loop: '', 'aria-hidden': 'true' });
  element.volume = volume;
  const title = node('span', { class: 'sound-track-title' });
  const status = node('span', { class: 'sound-track-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const toggleText = node('span');
  const toggle = node('button', { type: 'button', class: 'sound-toggle', 'data-audio-toggle': '' }, [icon('play'), toggleText]);
  const settings = node('button', {
    type: 'button', class: 'sound-settings-button', 'aria-expanded': 'false', 'aria-controls': 'preview-audio-settings',
  }, [icon('settings')]);
  const settingsTitle = node('strong');
  const closeSettings = node('button', { type: 'button', class: 'sound-settings-close' }, [icon('close')]);
  const volumeName = node('span');
  const volumeValue = node('output', { for: 'preview-music-volume' });
  const volumeInput = node('input', {
    id: 'preview-music-volume', type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(volume * 100)),
  });
  const ambientText = node('span');
  const ambientToggle = node('button', { type: 'button', class: 'sound-ambient-toggle', 'data-ambient-toggle': '' }, [ambientText]);
  const ambientHint = node('p', { class: 'sound-ambient-hint' });
  const panel = node('section', { id: 'preview-audio-settings', class: 'sound-settings-panel', hidden: '' }, [
    node('div', { class: 'sound-settings-heading' }, [settingsTitle, closeSettings]),
    node('label', { class: 'sound-volume-label', for: volumeInput.id }, [volumeName, volumeValue]),
    volumeInput, ambientToggle, ambientHint,
  ]);
  const wave = node('span', { class: 'sound-wave', 'aria-hidden': 'true' }, [node('i'), node('i'), node('i'), node('i')]);
  const row = node('div', { class: 'sound-dock-row' }, [wave, node('div', { class: 'sound-track-copy' }, [title, status]), toggle, settings]);
  dockRoot.classList.add('preview-audio-dock');
  dockRoot.append(element, row, panel);

  function save(key, value) {
    try { store.set(key, value); } catch { /* The shell store normally falls back to memory. */ }
  }

  function update() {
    if (destroyed) return;
    const playing = !element.paused && !element.ended && !mediaError;
    dockRoot.dataset.playing = String(playing);
    dockRoot.dataset.enabled = String(desired);
    title.textContent = t('باقي أثر · RAVEN', 'Baqi Athar · RAVEN');
    status.textContent = !desired ? t('الموسيقى متوقفة', 'Music is off')
      : holds.size ? t('الصوت للمشهد الآن', 'Scene audio has priority')
      : mediaError ? t('تعذر تحميل الأغنية · أعد المحاولة', 'Track unavailable · try again')
      : blocked ? t('اضغط تشغيل للاستماع', 'Press play to listen')
      : playing ? t('الموسيقى مستمرة معك', 'Music follows your journey')
      : waiting ? t('جارٍ تحميل الأغنية…', 'Loading the track…')
      : !armed ? t('تبدأ مع تفاعلك', 'Starts with your interaction')
      : t('الموسيقى جاهزة', 'Music is ready');
    const meansPause = playing || (desired && (waiting || holds.size > 0));
    toggleText.textContent = meansPause ? t('إيقاف', 'Pause') : t('تشغيل', 'Play');
    toggle.setAttribute('aria-label', meansPause ? t('إيقاف أغنية باقي أثر', 'Pause Baqi Athar') : t('تشغيل أغنية باقي أثر', 'Play Baqi Athar'));
    toggle.setAttribute('aria-pressed', String(desired && (playing || waiting || holds.size > 0)));
    toggle.querySelector('svg').replaceWith(icon(meansPause ? 'pause' : 'play'));
    settings.setAttribute('aria-label', t('إعدادات الصوت', 'Audio settings'));
    panel.setAttribute('aria-label', t('إعدادات الصوت', 'Audio settings'));
    settingsTitle.textContent = t('الموسيقى والأجواء', 'Music & atmosphere');
    closeSettings.setAttribute('aria-label', t('إغلاق إعدادات الصوت', 'Close audio settings'));
    volumeName.textContent = t('مستوى الأغنية', 'Music volume');
    volumeValue.textContent = `${Math.round(volume * 100)}%`;
    ambientText.textContent = ambientDesired ? t('أجواء التحقيق: مفعّلة', 'Investigation ambience: on') : t('أجواء التحقيق: متوقفة', 'Investigation ambience: off');
    ambientToggle.setAttribute('aria-pressed', String(ambientDesired));
    ambientHint.textContent = ambientFailed
      ? t('المؤثرات غير متاحة في هذا المتصفح.', 'Atmosphere effects are unavailable in this browser.')
      : t('صوت غرفة خافت ولمسات آلة كاتبة. يتوقف أثناء المشاهد.', 'Quiet room tone and typewriter touches. Pauses during scenes.');
  }

  function pauseSong() {
    playAttempt++;
    waiting = false;
    element.pause();
    update();
  }

  async function requestSong({ retry = false } = {}) {
    if (destroyed || !armed || !desired || holds.size || waiting || (!element.paused && !element.ended)) {
      update();
      return;
    }
    if (mediaError && !retry) return;
    const attempt = ++playAttempt;
    blocked = false;
    waiting = true;
    if (!element.hasAttribute('src')) element.src = SONG_URL;
    else if (retry && mediaError) element.load();
    mediaError = false;
    update();
    try {
      await element.play();
      if (destroyed || attempt !== playAttempt || !desired || holds.size) {
        if (destroyed || !desired || holds.size) element.pause();
        return;
      }
      waiting = false;
      blocked = false;
    } catch (error) {
      if (destroyed || attempt !== playAttempt) return;
      waiting = false;
      if (error?.name !== 'AbortError') {
        blocked = error?.name === 'NotAllowedError';
        mediaError = !blocked;
      }
    }
    update();
  }

  function hold(token) {
    if (destroyed) return;
    holds.add(String(token));
    pauseSong();
    syncAmbient();
  }

  function release(token) {
    if (destroyed) return;
    if (!holds.delete(String(token))) return;
    syncAmbient();
    if (!holds.size) requestSong();
    update();
  }

  // Temporary attenuation never overwrites the listener's saved volume or pause.
  function applyVolume() {
    element.volume = volume * (ducks.size ? Math.min(...ducks.values()) : 1);
  }
  function duck(token, factor = .18) {
    if (destroyed) return;
    ducks.set(String(token), clamp(factor, .18));
    applyVolume();
  }
  function unduck(token) {
    if (destroyed || !ducks.delete(String(token))) return;
    applyVolume();
  }

  // Called by playback controls as well as on the first global gesture. The
  // soundtrack can be armed while held by a film; its source stays untouched.
  function arm() { armed = true; }

  function onInteraction(event) {
    if (!event.isTrusted || destroyed) return;
    if (event.type === 'keydown' && (event.ctrlKey || event.metaKey || event.altKey || ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
    arm();
    const target = event.target instanceof Element ? event.target : null;
    const targetVideo = target?.closest('video');
    const mediaTarget = target?.closest('[data-media-start]') || (targetVideo && !targetVideo.muted && targetVideo.volume > 0);
    // Film buttons synchronously hold their token before calling play(). Native
    // video controls are also reserved by watchVideo before their click bubbles.
    if (!mediaTarget) requestSong();
    syncAmbient();
    update();
  }

  function openSettings(open) {
    panel.hidden = !open;
    settings.setAttribute('aria-expanded', String(open));
    if (open) volumeInput.focus();
  }

  toggle.addEventListener('click', () => {
    arm();
    const pause = !element.paused || (desired && (waiting || holds.size));
    desired = !pause;
    save('musicEnabled', desired);
    if (desired) requestSong({ retry: true });
    else pauseSong();
    update();
  }, { signal });
  settings.addEventListener('click', () => openSettings(panel.hidden), { signal });
  closeSettings.addEventListener('click', () => { openSettings(false); settings.focus(); }, { signal });
  volumeInput.addEventListener('input', () => {
    volume = clamp(Number(volumeInput.value) / 100);
    applyVolume();
    save('musicVolume', volume);
    update();
  }, { signal });
  ambientToggle.addEventListener('click', () => {
    arm();
    ambientDesired = !ambientDesired;
    ambientFailed = false;
    save('ambientEnabled', ambientDesired);
    syncAmbient();
    update();
  }, { signal });
  document.addEventListener('click', onInteraction, { signal });
  document.addEventListener('keydown', onInteraction, { signal });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !dockRoot.contains(event.target)) openSettings(false);
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      openSettings(false);
      settings.focus();
    }
  }, { signal });
  element.addEventListener('playing', () => { waiting = false; blocked = false; mediaError = false; update(); }, { signal });
  element.addEventListener('pause', update, { signal });
  element.addEventListener('ended', update, { signal });
  element.addEventListener('error', () => { mediaError = true; waiting = false; update(); }, { signal });

  function watchVideo(video) {
    if (videos.has(video)) return videos.get(video);
    const own = new AbortController();
    const token = `video-${++videoIndex}`;
    let released = false;
    const check = () => {
      if (!video.paused && !video.ended && !video.muted && video.volume > 0) hold(token);
      else release(token);
    };
    const finish = () => release(token);
    const reserve = event => {
      if (!event.isTrusted || video.muted || video.volume === 0) return;
      if (event.type === 'keydown' && ![' ', 'Enter', 'k'].includes(event.key)) return;
      arm();
      hold(token);
      const timer = setTimeout(() => {
        temporaryTimers.delete(timer);
        if (!released) check();
      }, 250);
      temporaryTimers.add(timer);
    };
    ['play', 'playing', 'volumechange'].forEach(name => video.addEventListener(name, check, { signal: own.signal }));
    ['pause', 'ended', 'error', 'emptied'].forEach(name => video.addEventListener(name, finish, { signal: own.signal }));
    video.addEventListener('pointerdown', reserve, { signal: own.signal });
    video.addEventListener('keydown', reserve, { signal: own.signal });
    const cleanup = () => {
      if (released) return;
      released = true;
      own.abort();
      videos.delete(video);
      release(token);
    };
    videos.set(video, cleanup);
    check();
    return cleanup;
  }

  function prepareRoom() {
    if (context) return context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('AudioContext unavailable');
    context = new AudioContext();
    roomGain = context.createGain();
    roomGain.gain.value = 0;
    roomGain.connect(context.destination);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = .25;
    filter.connect(roomGain);
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    let smoothed = 0;
    for (let i = 0; i < data.length; i++) {
      smoothed = (smoothed + .035 * (Math.random() * 2 - 1)) / 1.035;
      data[i] = smoothed * 4;
    }
    noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(filter);
    noise.start();
    hum = context.createOscillator();
    const humGain = context.createGain();
    hum.frequency.value = 57;
    hum.type = 'sine';
    humGain.gain.value = .07;
    hum.connect(humGain).connect(roomGain);
    hum.start();
    return context;
  }

  async function syncAmbient() {
    const request = ++ambientRequest;
    const enabled = armed && ambientDesired && !holds.size && !document.hidden && !destroyed;
    if (!enabled) {
      if (context && roomGain) {
        roomGain.gain.cancelScheduledValues(context.currentTime);
        roomGain.gain.setValueAtTime(0, context.currentTime);
        if (context.state === 'running') context.suspend().catch(() => {});
      }
      return;
    }
    try {
      const ctx = prepareRoom();
      if (ctx.state !== 'running') await ctx.resume();
      if (destroyed || request !== ambientRequest || !ambientDesired || holds.size || document.hidden) {
        if (!destroyed && (!ambientDesired || holds.size || document.hidden) && ctx.state === 'running') ctx.suspend().catch(() => {});
        return;
      }
      roomGain.gain.cancelScheduledValues(ctx.currentTime);
      roomGain.gain.setTargetAtTime(.025, ctx.currentTime, .25);
    } catch {
      ambientFailed = true;
      update();
    }
  }

  function typewriter() {
    if (!armed || !ambientDesired || holds.size || document.hidden || destroyed || !context || context.state !== 'running') return;
    const now = performance.now();
    if (now - lastTyping < 900) return;
    lastTyping = now;
    for (let i = 0; i < 4; i++) {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .018), context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let j = 0; j < channel.length; j++) channel[j] = (Math.random() * 2 - 1) * (1 - j / channel.length);
      const click = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = .012;
      click.buffer = buffer;
      click.connect(gain).connect(roomGain);
      click.start(context.currentTime + i * .065);
      click.onended = () => { click.disconnect(); gain.disconnect(); };
    }
  }
  document.addEventListener('raven:typewrite', typewriter, { signal });
  document.addEventListener('visibilitychange', syncAmbient, { signal });
  update();

  return {
    element, hold, release, duck, unduck, watchVideo,
    refreshLanguage: update,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      [...videos.values()].forEach(cleanup => cleanup());
      temporaryTimers.forEach(clearTimeout);
      temporaryTimers.clear();
      element.pause();
      element.removeAttribute('src');
      element.load();
      try { noise?.stop(); hum?.stop(); } catch { /* Already stopped. */ }
      if (context && context.state !== 'closed') context.close().catch(() => {});
      dockRoot.replaceChildren();
    },
  };
}
