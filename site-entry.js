// A session welcome, independent of the persistent soundtrack and page routing.
// The first visit in a session plays the RAVEN intro film. If the film cannot
// play, or motion is reduced, the welcome text and the enter button are shown.
export function createEntryGate({ root, show = false, onEnter, onClose } = {}) {
  if (!show || typeof HTMLDialogElement === 'undefined') return null;
  let seen = false;
  try { seen = sessionStorage.getItem('raven_studio_ident_v1') === '1'; } catch {}
  if (seen) return null;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let intro = !reduceMotion;
  const dialog = document.createElement('dialog');
  dialog.id = 'archive-entry-gate';
  dialog.className = intro ? 'archive-entry is-intro' : 'archive-entry is-fallback';
  dialog.setAttribute('aria-labelledby', 'archive-entry-title');
  dialog.setAttribute('aria-describedby', 'archive-entry-copy');
  // Only static editorial content is inserted; visitor input never enters HTML.
  dialog.innerHTML = `
    <video class="archive-intro" playsinline muted preload="auto" aria-label="مقدمة رايفن"></video>
    <img class="archive-entry-art" alt="" aria-hidden="true">
    <div class="archive-entry-content">
      <p class="archive-entry-kicker">RAVEN · THE ARCHIVE</p>
      <div class="archive-entry-mark" aria-hidden="true">R</div>
      <h1 id="archive-entry-title">بعض الأدلة تنتظر ضوءًا آخر.</h1>
      <p id="archive-entry-copy">قصص تُشاهد. وأثر تفحصه بنفسك.</p>
      <button id="archive-enter" type="button">ادخل عالم رايفن</button>
      <p id="archive-entry-note">يمكنك التحكم بالأغنية من شريط الصوت.</p>
    </div>
    <div class="archive-intro-controls">
      <button id="archive-sound" class="archive-sound" type="button">تشغيل الصوت</button>
      <button id="archive-skip" type="button">تخطَّ المقدمة</button>
    </div>`;
  const video = dialog.querySelector('.archive-intro');
  const content = dialog.querySelector('.archive-entry-content');
  const soundButton = dialog.querySelector('#archive-sound');
  const skipButton = dialog.querySelector('#archive-skip');
  const enterButton = dialog.querySelector('#archive-enter');
  dialog.querySelector('img').src = new URL('assets/raven-home-share.jpg', root).href;
  const sync = (language = document.documentElement.lang) => {
    const en = language === 'en';
    dialog.lang = en ? 'en' : 'ar';
    dialog.dir = en ? 'ltr' : 'rtl';
    dialog.querySelector('#archive-entry-title').textContent = en
      ? 'Some clues await a different light.' : 'بعض الأدلة تنتظر ضوءًا آخر.';
    dialog.querySelector('#archive-entry-copy').textContent = en
      ? 'Stories to watch. A trace to examine yourself.' : 'قصص تُشاهد. وأثر تفحصه بنفسك.';
    enterButton.textContent = en ? 'Enter the world of RAVEN' : 'ادخل عالم رايفن';
    skipButton.textContent = en ? 'Skip introduction' : 'تخطَّ المقدمة';
    soundButton.textContent = en
      ? (video.muted ? 'Turn on sound' : 'Mute sound') : (video.muted ? 'تشغيل الصوت' : 'كتم الصوت');
    dialog.querySelector('#archive-entry-note').textContent = en
      ? 'Control the soundtrack from the sound bar.' : 'يمكنك التحكم بالأغنية من شريط الصوت.';
  };
  let stall = 0;
  // A film that cannot play is replaced by the welcome text, so the visitor is never stuck.
  const showFallback = () => {
    if (!intro) return;
    intro = false;
    clearTimeout(stall);
    try { video.pause(); } catch {}
    video.removeAttribute('src');
    video.load();
    dialog.classList.replace('is-intro', 'is-fallback');
    enterButton.focus();
  };
  enterButton.addEventListener('click', event => {
    onEnter?.(event);
    dialog.close();
  });
  skipButton.addEventListener('click', () => dialog.close());
  soundButton.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) video.play().catch(() => {});
    sync();
  });
  video.addEventListener('ended', () => dialog.close());
  video.addEventListener('error', showFallback);
  dialog.addEventListener('close', () => {
    try { sessionStorage.setItem('raven_studio_ident_v1', '1'); } catch {}
    try { video.pause(); } catch {}
    onClose?.();
    dialog.remove();
  }, { once: true });
  document.body.append(dialog);
  sync(new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : document.documentElement.lang);
  try { dialog.showModal(); } catch { dialog.remove(); return null; }
  if (intro) {
    video.src = new URL('assets/intro/raven-intro.mp4', root).href;
    video.poster = new URL('assets/intro/raven-intro.jpg', root).href;
    stall = setTimeout(() => { if (video.readyState < 2) showFallback(); }, 12000);
    video.addEventListener('canplay', () => clearTimeout(stall), { once: true });
    const started = video.play();
    if (started?.catch) started.catch(showFallback);
    skipButton.focus();
  } else {
    enterButton.focus();
  }
  return { sync, get open() { return dialog.open; } };
}
