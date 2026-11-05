let soundtrack;

// Play order. Each file sits under the site root; titles come from the files' own tags.
export const TRACKS = [
  { title: 'Raven: Return of the Shadows', file: 'assets/audio/raven/01.mp3' },
  { title: 'Raven by Abdulrahman', file: 'assets/audio/raven/02.mp3' },
  { title: 'RAVEN — A Beautiful Alibi', file: 'assets/audio/raven/03.mp3' },
  { title: 'RAVEN — Keep Me Guessing', file: 'assets/audio/raven/04.mp3' },
  { title: 'RAVEN — Keep Me Guessing', file: 'assets/audio/raven/05.mp3' },
  { title: 'Raven', file: 'assets/audio/raven/06.mp3' },
  { title: 'Raven: Return of the Shadows', file: 'assets/audio/raven/07.mp3' },
  { title: 'RAVEN — A Beautiful Alibi', file: 'assets/audio/raven/08.mp3' },
  { title: 'Raven by Abdulrahman', file: 'assets/audio/raven/09.mp3' },
  { title: 'Raven, Keep Me Guessing', file: 'assets/audio/raven/10.mp3' },
  { title: 'Raven', file: 'assets/audio/raven/11.mp3' },
  { title: 'Raven, Keep Me Guessing', file: 'assets/audio/raven/12.mp3' },
  { title: 'RAVEN — Keep Me Guessing', file: 'assets/audio/raven/13.mp3' }
];

// The outer document owns this one player throughout navigation.
export function createSoundtrack(rootURL) {
  if (soundtrack) return soundtrack;
  const audio = document.querySelector('#site-soundtrack');
  const toggle = document.querySelector('#music-toggle');
  const previous = document.querySelector('#music-prev');
  const next = document.querySelector('#music-next');
  const trackPicker = document.querySelector('#music-track-picker');
  const trackPickerLabel = document.querySelector('#music-track-label');
  const trackNumber = document.querySelector('#music-track-number');
  const trackTitle = document.querySelector('#music-track-title');
  const mute = document.querySelector('#music-mute');
  const status = document.querySelector('#music-status');
  const volume = document.querySelector('#music-volume');
  const volumeLabel = document.querySelector('#music-volume-label');
  const settingsLabel = document.querySelector('#music-settings-label');
  const volumeHint = document.querySelector('#music-volume-hint');
  const cinematicControl = document.querySelector('#music-cinematic');
  const cinematicLabel = document.querySelector('#music-cinematic-label');
  const cinematicHint = document.querySelector('#music-cinematic-hint');
  const region = document.querySelector('.site-player');
  const download = document.querySelector('.music-download');
  const volumeKey = 'raven_music_volume_v1';
  const cinematicKey = 'raven_music_cinematic_v1';
  const trackKey = 'raven_music_track_v1';
  const muteKey = 'raven_music_muted_v1';
  const base = rootURL;
  // The visitor asked for playback. Pages always start paused.
  let enabled = false;
  let index = readTrackIndex();
  let muted = false;
  let mediaActive = false;
  let phase = 'paused';
  let attempt = 0;
  let deviceVolume = false;
  let cinematic = true;
  let context = null;
  let source = null;
  let filter = null;
  let output = null;
  let graphTask = null;
  let unavailable = false;
  let resumeBlocked = false;
  let depth = 0;
  let depthSource;
  let pulseUntil = 0;
  let pulseTimer;
  try { cinematic = localStorage.getItem(cinematicKey) !== 'off'; } catch {}
  try { muted = localStorage.getItem(muteKey) === 'on'; } catch {}

  function readTrackIndex() {
    try {
      const saved = Number(localStorage.getItem(trackKey));
      if (Number.isInteger(saved) && saved >= 0 && saved < TRACKS.length) return saved;
    } catch {}
    return 0;
  }

  function trackURL(position) {
    return new URL(TRACKS[position].file, base).href;
  }

  function setDownload() {
    if (!download) return;
    download.href = trackURL(index);
    download.setAttribute('download', `RAVEN-${String(index + 1).padStart(2, '0')}.mp3`);
  }

  function active() {
    return enabled && ['starting', 'playing', 'waiting', 'suspended'].includes(phase);
  }

  function state() {
    return {
      playing: phase === 'playing' && !audio.paused && !audio.error &&
        (!source || context.state === 'running'),
      enabled, phase
    };
  }

  function playbackPhase() {
    if (!enabled) return 'paused';
    if (mediaActive) return 'suspended';
    if (audio.paused) return 'paused';
    if (audio.error) return 'error';
    if (source && context.state !== 'running') return 'blocked';
    return audio.readyState >= 3 ? 'playing' : 'waiting';
  }

  function sync() {
    const english = document.documentElement.lang === 'en';
    toggle.textContent = active() ? (english ? 'Pause music' : 'إيقاف الأغنية') :
      (english ? 'Play music' : 'تشغيل الأغنية');
    toggle.setAttribute('aria-pressed', String(active()));
    const messages = {
      starting: english ? 'Starting the music…' : 'جارٍ بدء الأغنية…',
      playing: english ? 'RAVEN · Now playing' : 'RAVEN · الأغنية شغّالة',
      suspended: english ? 'Music paused while media plays' : 'الأغنية متوقفة أثناء تشغيل المقطع',
      waiting: english ? 'Buffering the music…' : 'جارٍ تحميل الأغنية…',
      blocked: english ? 'Tap to start the music' : 'اضغط لتبدأ الأغنية',
      error: english ? 'This track could not play. Pick another, or press Play to retry.' :
        'تعذّر تشغيل هذه الأغنية. اختر أغنية أخرى، أو اضغط تشغيل للمحاولة.',
      paused: english ? 'RAVEN · Music paused' : 'RAVEN · الأغنية متوقفة'
    };
    status.textContent = messages[phase];
    if (trackNumber) trackNumber.textContent = english ? `Track ${index + 1} of ${TRACKS.length}` : `${index + 1} من ${TRACKS.length}`;
    if (trackTitle) trackTitle.textContent = TRACKS[index].title;
    if (trackPickerLabel) trackPickerLabel.textContent = english ? 'Track' : 'اختر الأغنية';
    if (trackPicker) {
      trackPicker.value = String(index);
      trackPicker.setAttribute('aria-label', english ? 'Choose a track' : 'اختر الأغنية');
    }
    if (previous) {
      previous.textContent = english ? 'Previous' : 'السابقة';
      previous.setAttribute('aria-label', english ? 'Previous track' : 'الأغنية السابقة');
    }
    if (next) {
      next.textContent = english ? 'Next' : 'التالية';
      next.setAttribute('aria-label', english ? 'Next track' : 'الأغنية التالية');
    }
    if (mute) {
      mute.textContent = english ? (muted ? 'Unmute' : 'Mute') : (muted ? 'إلغاء الكتم' : 'كتم الصوت');
      mute.setAttribute('aria-pressed', String(muted));
    }
    region?.setAttribute('aria-label', english ? 'RAVEN music' : 'أغنية رايفن');
    if (download) {
      download.setAttribute('aria-label', english ? 'Download the RAVEN song' : 'تنزيل أغنية رايفن');
      download.textContent = english ? 'Download song · MP3' : 'تنزيل الأغنية · MP3';
    }
    volume.setAttribute('aria-label', english ? 'Music volume' : 'مستوى صوت الأغنية');
    if (volumeLabel) volumeLabel.textContent = english ? 'Volume' : 'الصوت';
    if (settingsLabel) {
      settingsLabel.textContent = english ? 'Sound' : 'الصوت';
      settingsLabel.setAttribute('aria-label', english ? 'Sound settings' : 'إعدادات الصوت');
    }
    if (volumeHint) {
      volumeHint.hidden = !deviceVolume;
      volumeHint.textContent = english ? 'Use your device buttons to adjust the volume.' :
        'استخدم أزرار جهازك للتحكم بمستوى الصوت.';
    }
    if (cinematicControl) {
      cinematicControl.checked = cinematic && !unavailable;
      cinematicControl.disabled = unavailable;
      cinematicControl.setAttribute('aria-label', english ? 'Cinematic sound' : 'الصوت السينمائي');
    }
    if (cinematicLabel) cinematicLabel.textContent = english ? 'Cinematic sound' : 'الصوت السينمائي';
    if (cinematicHint) {
      cinematicHint.textContent = unavailable || (resumeBlocked && !source)
        ? (english ? 'The effect is unavailable here; original audio is retained.' :
          'المؤثر غير متاح هنا؛ يبقى صوت الأغنية الأصلي.')
        : source && context.state !== 'running' && enabled && !audio.paused
          ? (english ? 'Tap Play music to resume the sound.' : 'اضغط تشغيل الأغنية لاستئناف الصوت.')
          : cinematic
            ? (english ? 'The tone changes gently as you scroll.' : 'يتغيّر طابع الصوت برفق أثناء التمرير.')
            : (english ? 'The song plays with its original sound.' : 'الأغنية بصوتها الأصلي.');
    }
  }

  function applyDepth() {
    if (!filter || !context || !cinematic || unavailable) return;
    const ceiling = Math.min(18000, context.sampleRate * 0.45);
    const floor = Math.min(5500, ceiling * 0.55);
    const accent = performance.now() < pulseUntil ? 0.78 : 1;
    const frequency = ceiling * Math.pow(floor / ceiling, depth) * accent;
    const now = context.currentTime;
    try {
      const current = filter.frequency.value;
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(current, now);
      filter.frequency.setTargetAtTime(frequency, now, 0.18);
    } catch {
      unavailable = true;
      bypassFilter();
      sync();
    }
  }

  function bypassFilter() {
    if (!source) return;
    // Keep a live destination connected before removing the processing path.
    // Disconnecting a MediaElementAudioSource does not restore native output.
    try {
      source.connect(context.destination);
      if (output && output !== context.destination) source.disconnect(output);
      output = context.destination;
    } catch { /* Keep the previously connected path if rerouting is unavailable. */ }
  }

  function routeFilter() {
    if (!source) return;
    if (!cinematic || unavailable) { bypassFilter(); return; }
    applyDepth();
    if (unavailable || output === filter) return;
    try {
      source.connect(filter);
      if (output) source.disconnect(output);
      output = filter;
    } catch {
      unavailable = true;
      bypassFilter();
    }
  }

  // Only called from trusted clicks/keyboard interactions. A failed resume
  // leaves the media element on its native path until a context is running.
  function prepareGraph() {
    if (graphTask || (unavailable && !source) || (!cinematic && !source)) return graphTask;
    graphTask = (async () => {
      try {
        if (!context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) { unavailable = true; sync(); return; }
          context = new AudioContext();
          context.addEventListener('statechange', () => {
            if (source && enabled && !audio.paused) phase = playbackPhase();
            sync();
          });
        }
        if (context.state !== 'running') await context.resume();
        if (context.state !== 'running') throw new Error('Audio context is not running');
        resumeBlocked = false;
      } catch {
        resumeBlocked = true;
        if (source && enabled && !audio.paused) phase = 'blocked';
        sync();
        return;
      }
      if (!source && cinematic) {
        try {
          // Prepare the processing path before the irreversible element binding.
          filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.Q.value = Math.SQRT1_2;
          filter.frequency.value = Math.min(18000, context.sampleRate * 0.45);
          filter.connect(context.destination);
          source = context.createMediaElementSource(audio);
          source.connect(context.destination);
          output = context.destination;
        } catch {
          unavailable = true;
          bypassFilter();
          sync();
          return;
        }
      }
      routeFilter();
      if (source && enabled && !audio.paused) phase = playbackPhase();
      sync();
    })().finally(() => { graphTask = null; });
    return graphTask;
  }

  function setDepth(ratio, sourceToken) {
    const value = Number(ratio);
    depth = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    if (sourceToken !== undefined && sourceToken !== depthSource) {
      depthSource = sourceToken;
      clearTimeout(pulseTimer);
      pulseUntil = 0;
    }
    applyDepth();
    return depth;
  }

  function pulse() {
    if (!cinematic || unavailable || !source || !state().playing) return false;
    clearTimeout(pulseTimer);
    pulseUntil = performance.now() + 650;
    applyDepth();
    pulseTimer = setTimeout(() => { pulseUntil = 0; applyDepth(); }, 650);
    return true;
  }

  function setVolume(value, save = false) {
    const number = Number(value);
    const level = Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0.45;
    try {
      audio.volume = level;
      deviceVolume = Math.abs(audio.volume - level) > 0.001;
      if (!deviceVolume && save) {
        try { localStorage.setItem(volumeKey, String(level)); } catch {}
      }
    } catch { deviceVolume = true; }
    volume.value = String(level);
    volume.disabled = deviceVolume;
    if (deviceVolume && volumeHint) volume.setAttribute('aria-describedby', volumeHint.id);
    else volume.removeAttribute('aria-describedby');
    sync();
  }

  function failed(id, error) {
    if (id !== attempt) return;
    if (mediaActive) phase = 'suspended';
    else if (!enabled || error?.name === 'AbortError') phase = 'paused';
    else if (error?.name === 'NotAllowedError') phase = 'blocked';
    else {
      // A file that cannot play stops here. The visitor chooses another track or retries.
      enabled = false;
      phase = 'error';
    }
    sync();
  }

  function play() {
    if (!enabled) return;
    if (mediaActive) { phase = 'suspended'; sync(); return; }
    // Every request gets an id. A stale promise from an earlier track or tap is ignored.
    const id = ++attempt;
    phase = 'starting';
    sync();
    try {
      if (audio.error) audio.load();
      const result = audio.play();
      Promise.resolve(result).then(() => {
        if (id !== attempt) {
          if (!enabled || mediaActive) audio.pause();
          return;
        }
        if (!enabled || mediaActive) audio.pause();
        phase = playbackPhase();
        sync();
      }).catch(error => failed(id, error));
    } catch (error) { failed(id, error); }
  }

  function setMediaActive(value) {
    const next = Boolean(value);
    if (mediaActive === next) return;
    mediaActive = next;
    ++attempt;
    if (mediaActive) {
      phase = enabled ? 'suspended' : 'paused';
      audio.pause();
      sync();
    } else {
      phase = 'paused';
      sync();
      if (enabled) play();
    }
  }

  // Trusted gestures only prepare the audio path. Playback starts from the player's own controls.
  function gesture(event) {
    if (!event.isTrusted || event.repeat || event.isComposing) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    // A checkbox's change handler must read its new value before sync renders it.
    if (event.target.closest?.('#music-settings, #music-volume, audio, video')) return;
    if (enabled) prepareGraph();
  }

  // The entry gate's enter button is an explicit visitor choice, so it starts the list.
  function enter(event) {
    if (!event?.isTrusted) return;
    prepareGraph();
    if (!enabled) {
      enabled = true;
      play();
    }
  }

  function toggleMusic() {
    if (active()) {
      enabled = false;
      ++attempt;
      phase = 'paused';
      audio.pause();
      sync();
    } else {
      enabled = true;
      prepareGraph();
      play();
    }
  }

  // A list that is playing keeps playing on the new track. A paused list stays paused.
  function selectTrack(position) {
    const count = TRACKS.length;
    const number = Math.trunc(Number(position));
    index = ((Number.isFinite(number) ? number : 0) % count + count) % count;
    try { localStorage.setItem(trackKey, String(index)); } catch {}
    ++attempt; // A play() still waiting on the previous file must not take over.
    audio.pause();
    audio.src = trackURL(index);
    setDownload();
    if (enabled) play();
    else phase = 'paused';
    sync();
  }

  function step(delta) {
    selectTrack(index + delta);
  }

  function setMuted(value, save = false) {
    muted = Boolean(value);
    audio.muted = muted;
    if (save) {
      try { localStorage.setItem(muteKey, muted ? 'on' : 'off'); } catch {}
    }
    sync();
  }

  toggle.addEventListener('click', toggleMusic);
  previous?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));
  trackPicker?.addEventListener('change', () => selectTrack(trackPicker.value));
  mute?.addEventListener('click', () => setMuted(!muted, true));
  volume.addEventListener('input', () => setVolume(volume.value, true));
  cinematicControl?.addEventListener('change', event => {
    cinematic = cinematicControl.checked;
    clearTimeout(pulseTimer);
    pulseUntil = 0;
    try { localStorage.setItem(cinematicKey, cinematic ? 'on' : 'off'); } catch {}
    routeFilter();
    if (event.isTrusted) prepareGraph();
    sync();
  });
  audio.addEventListener('play', () => {
    if (!enabled || mediaActive) { audio.pause(); phase = playbackPhase(); sync(); return; }
    phase = 'starting';
    sync();
  });
  audio.addEventListener('playing', () => {
    if (!enabled || mediaActive) { audio.pause(); phase = playbackPhase(); sync(); return; }
    phase = playbackPhase();
    sync();
  });
  const waiting = () => {
    if (enabled && !mediaActive && !audio.paused && !audio.error) { phase = 'waiting'; sync(); }
  };
  audio.addEventListener('waiting', waiting);
  audio.addEventListener('stalled', () => { if (audio.readyState < 3) waiting(); });
  audio.addEventListener('pause', () => {
    // Queued events may belong to the source that selectTrack just replaced.
    if (!audio.paused) return;
    clearTimeout(pulseTimer);
    pulseUntil = 0;
    applyDepth();
    if (!enabled) {
      // A queued pause must preserve an explicit stop, even if a later load failed.
      // A failure already reported by the active operation remains visible.
      if (phase !== 'error') phase = 'paused';
    } else if (mediaActive) phase = 'suspended';
    else if (!['blocked', 'error'].includes(phase)) phase = audio.error ? 'error' : 'paused';
    sync();
  });
  audio.addEventListener('error', () => {
    // Consult current media state instead of treating an old event as current failure.
    if (!audio.error || !enabled) return;
    ++attempt;
    enabled = false;
    phase = 'error';
    sync();
  });
  audio.addEventListener('ended', () => {
    if (!audio.ended || audio.currentSrc !== trackURL(index)) return;
    // The list runs in order and wraps from the last track back to the first.
    // Advance a completed track even while foreground media owns the speakers.
    // selectTrack/play preserve suspension and defer actual playback until it ends.
    if (enabled) { selectTrack(index + 1); return; }
    phase = enabled && mediaActive ? 'suspended' : 'paused';
    sync();
  });
  document.addEventListener('click', gesture);
  document.addEventListener('keydown', gesture);

  let initialVolume = volume.value;
  try {
    const saved = localStorage.getItem(volumeKey);
    if (saved !== null) initialVolume = saved;
  } catch {}
  setVolume(initialVolume);
  // Nothing downloads until the visitor presses play. Pages never start on their own.
  audio.loop = false;
  audio.preload = 'none';
  audio.muted = muted;
  audio.src = trackURL(index);
  trackPicker?.replaceChildren(...TRACKS.map((track, position) => new Option(`${position + 1}. ${track.title}`, String(position))));
  setDownload();
  soundtrack = { gesture, enter, toggleMusic, state, sync, setDepth, pulse, setMediaActive };
  sync();
  return soundtrack;
}
