import { el } from './core.js?v=abc27e4aad89ec10';
import { HERO, EPISODES, ZARQA } from './catalog.js?v=abc27e4aad89ec10';

export function mount(root, services, route = '') {
  const { t, store, audio } = services;
  const disposers = [];
  const videos = [];
  const link = (path, ar, en, primary = false) => el('a', { class: `button${primary ? ' primary' : ''}`, href: services.routeURL(path), text: t(ar, en) });
  const eyebrow = (ar, en) => el('p', { class: 'eyebrow', text: t(ar, en) });
  const getProgress = id => {
    const value = store.get('episode:' + id, {});
    return value && typeof value === 'object' ? value : {};
  };

  function episodeCard(episode) {
    const saved = getProgress(episode.progressId);
    const path = `raven-17/part-${episode.id}/`;
    return el('article', { class: 'film-card', 'data-episode-card': episode.id }, [
      el('a', { class: 'film-image-link', href: services.routeURL(path), 'aria-label': t(`شاهد الجزء ${episode.id}`, `Watch part ${episode.id}`) }, [
        el('img', { src: episode.poster, alt: t(`مشهد من RAVEN 17 — الجزء ${episode.id}`, `RAVEN 17 — part ${episode.id}`), loading: 'lazy', width: 480, height: 720 }),
      ]),
      el('div', { class: 'film-card-body' }, [
        el('div', { class: 'film-meta' }, [el('span', { text: `PART 0${episode.id}`, dir: 'ltr' }), el('span', { text: episode.durationLabel, dir: 'ltr' })]),
        el('h3', { text: t(episode.labelAr, episode.labelEn) }),
        el('p', { class: 'muted', text: t('من سلسلة RAVEN 17 السينمائية.', 'A chapter of the RAVEN 17 series.') }),
        saved.watched ? el('span', { class: 'watched-tag', text: t('✓ شاهدته', '✓ Watched') }) : saved.time > 2 ? el('span', { class: 'watched-tag', text: t(`استكمل من ${formatTime(saved.time)}`, `Resume at ${formatTime(saved.time)}`) }) : null,
        link(path, saved.time > 2 && !saved.watched ? 'واصل المشاهدة ←' : 'شاهد الجزء ←', saved.time > 2 && !saved.watched ? 'Resume →' : 'Watch part →'),
      ]),
    ]);
  }

  function filmsSection(full = false) {
    return el('section', { class: 'section films-section', id: 'films' }, [
      el('div', { class: 'section-heading' }, [el('div', {}, [eyebrow('يُعرض الآن · سلسلة أصلية', 'NOW SCREENING · ORIGINAL SERIES'),
        el(full ? 'h1' : 'h2', { text: 'RAVEN 17', dir: 'ltr' }), el('p', { class: 'section-lead', text: t('جزآن. ابدأ من الأثر الأول.', 'Two chapters. Follow the first trace.') })]),
        !full ? el('span', { class: 'section-index', text: '01 / CINEMA', dir: 'ltr' }) : null]),
      el('div', { class: 'film-grid' }, EPISODES.map(episodeCard)),
    ]);
  }

  function upcoming() {
    return el('section', { class: 'section upcoming-section', id: 'coming-soon' }, [
      el('div', {}, [eyebrow('الفصل القادم', 'THE NEXT CHAPTER'), el('span', { class: 'status-stamp', text: t('قيد التطوير', 'IN DEVELOPMENT') }),
        el('h2', { text: t('زرقاء اليمامة', 'Zarqa Al-Yamama') }),
        el('p', { class: 'section-lead', text: t('بين الرؤية والدليل.', 'Between vision and evidence.') }),
        el('p', { class: 'muted', text: t('رؤية جديدة للأسطورة، من عالم RAVEN.', 'A new vision of the legend, from the world of RAVEN.') }),
        link('zarqa/', 'اكتشف الفيلم القادم ←', 'Discover the next film →'),
      ]),
      el('a', { class: 'zarqa-preview', href: services.routeURL('zarqa/'), 'aria-label': t('زرقاء اليمامة — الإعلان', 'Zarqa Al-Yamama — teaser') }, [el('img', { src: ZARQA.poster, loading: 'lazy', alt: t('من إعلان زرقاء اليمامة', 'A frame from Zarqa Al-Yamama'), width: 512, height: 910 })]),
    ]);
  }

  function home() {
    document.title = t('RAVEN — كل حكاية تترك أثرًا', 'RAVEN — Every story leaves a trace');
    const hero = el('video', { class: 'home-hero-video', poster: HERO.poster, muted: true, playsinline: true, loop: true, preload: 'none', 'aria-label': t('افتتاحية RAVEN السينمائية الصامتة', 'RAVEN silent cinematic opening'), 'data-ambient-video': '' });
    hero.muted = true;
    const replay = el('button', { type: 'button', class: 'text-button', text: t('إعادة الافتتاحية', 'Replay opening'), onClick: () => services.opening.show() });
    const pause = el('button', { type: 'button', class: 'text-button', text: t('إيقاف الحركة', 'Pause motion'), onClick: () => {
      if (hero.paused) { if (!hero.getAttribute('src')) hero.src = HERO.video; hero.play().catch(() => {}); }
      else hero.pause();
    } });
    hero.addEventListener('play', () => pause.textContent = t('إيقاف الحركة', 'Pause motion'));
    hero.addEventListener('pause', () => pause.textContent = t('تشغيل المشهد', 'Play scene'));
    if (services.motionAllowed() && !services.opening.active) { hero.src = HERO.video; hero.autoplay = true; hero.play().catch(() => {}); }
    else pause.textContent = t('تشغيل المشهد', 'Play scene');
    videos.push(hero);
    root.append(el('div', { class: 'home-page' }, [
      el('section', { class: 'home-hero' }, [
        el('div', { class: 'hero-topline' }, [el('span', { text: 'INDEPENDENT CINEMA', dir: 'ltr' }), el('span', { text: 'RAVEN / 017', dir: 'ltr' })]),
        el('figure', { class: 'home-hero-frame' }, [hero]),
        el('div', { class: 'scene-actions' }, [el('span', { text: t('من عالم RAVEN', 'FROM THE WORLD OF RAVEN') }), el('div', { class: 'inline-actions' }, [pause, replay])]),
        el('div', { class: 'hero-copy' }, [el('div', {}, [eyebrow('أفلام غموض وتحقيقات تفاعلية', 'MYSTERY FILMS & INTERACTIVE INVESTIGATIONS'),
          el('h1', {}, [t('كل حكاية', 'Every story'), el('br'), el('em', { text: t('تترك أثرًا.', 'leaves a trace.') })])]),
          el('div', { class: 'hero-actions' }, [link('raven-17/', 'شاهد RAVEN 17 ←', 'Watch RAVEN 17 →', true), el('p', { text: t('شاهد الحكاية. اقترب من التفاصيل. واتبع ما تركته خلفها.', 'Watch the story. Look closer. Follow what it leaves behind.') })]),
        ]),
      ]),
      filmsSection(), upcoming(),
      el('section', { class: 'section creator-section', id: 'creator' }, [eyebrow('خلف الإطار', 'BEHIND THE FRAME'),
        el('h2', { text: t('عبدالرحمن العتيبي', 'Abdulrahman Alotaibi') }),
        el('p', { class: 'section-lead', text: t('أصنع عوالم تبدأ بصورة، وتبقى بما تتركه من أسئلة.', 'I create worlds that begin with an image and linger through their questions.') }),
        el('a', { class: 'button', href: 'https://project25762.websitepublisher.ai/#raven-collaborate', target: '_blank', rel: 'noopener noreferrer', text: t('للتعاون والتواصل →', 'Collaborate →') }),
      ]),
    ]));
  }

  function theater(item, isTeaser = false) {
    const partLabel = isTeaser ? t('زرقاء اليمامة', 'Zarqa Al-Yamama') : `RAVEN 17 — ${t(item.labelAr, item.labelEn)}`;
    document.title = partLabel + ' | RAVEN';
    const saved = isTeaser ? {} : getProgress(item.progressId);
    const video = el('video', { class: 'theater-video', poster: item.poster, playsinline: true, controls: true, preload: 'none', 'aria-label': partLabel, 'data-film-video': isTeaser ? 'zarqa' : item.id });
    const status = el('p', { class: 'player-status', role: 'status', text: saved.time > 2 && !saved.watched ? t(`يمكنك الاستكمال من ${formatTime(saved.time)}`, `Resume available at ${formatTime(saved.time)}`) : t('جاهز للمشاهدة', 'Ready to watch') });
    let started = false;
    let failed = false;
    let disposed = false;
    let lastSaved = 0;
    let startHold = `film-start-${isTeaser ? 'zarqa' : item.id}`;
    const save = (ended = false) => {
      if (isTeaser || !started || disposed) return;
      const prior = getProgress(item.progressId);
      store.set('episode:' + item.progressId, { time: ended ? 0 : Math.floor(video.currentTime || 0), watched: Boolean(ended || prior.watched) });
    };
    const play = (restart = false) => {
      audio.hold(startHold);
      if (!video.getAttribute('src')) video.src = item.src;
      if (!started) {
        started = true;
        video.addEventListener('loadedmetadata', () => {
          if (!restart && saved.time > 2 && saved.time < video.duration - 2) video.currentTime = saved.time;
        }, { once: true });
      } else if (restart) video.currentTime = 0;
      if (failed) { failed = false; video.load(); }
      video.play().then(() => { audio.release(startHold); }).catch(() => {
        audio.release(startHold); status.textContent = t('تعذّر التشغيل. حاول مجددًا أو افتح رابط الفيديو.', 'Playback failed. Retry or open the video link.');
      });
    };
    const playButton = el('button', { class: 'button primary', type: 'button', 'data-media-start': 'true', text: t(saved.time > 2 && !saved.watched ? 'واصل المشاهدة ▶' : 'شغّل الفيلم ▶', saved.time > 2 && !saved.watched ? 'Resume ▶' : 'Play film ▶'), onClick: () => { if (!video.paused) video.pause(); else play(); } });
    video.addEventListener('click', () => { if (!video.getAttribute('src')) play(); });
    video.addEventListener('keydown', event => { if (!video.getAttribute('src') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); play(); } });
    video.addEventListener('playing', () => { status.textContent = t('تُعرض الآن', 'Now playing'); playButton.textContent = t('إيقاف المشهد مؤقتًا', 'Pause film'); });
    video.addEventListener('pause', () => { playButton.textContent = t('واصل المشاهدة ▶', 'Resume ▶'); });
    // Separate replay keeps the original play action predictable and keyboard accessible.
    video.addEventListener('error', () => { failed = true; audio.release(startHold); status.textContent = t('الفيديو غير متاح الآن. أعد المحاولة أو افتح الرابط المباشر.', 'The film is unavailable. Retry or open its direct link.'); });
    video.addEventListener('timeupdate', () => { if (Math.abs(video.currentTime - lastSaved) >= 4) { lastSaved = video.currentTime; save(); } });
    video.addEventListener('pause', () => save());
    video.addEventListener('ended', () => { save(true); status.textContent = t('حُفظت المشاهدة. الأثر التالي ينتظرك.', 'Marked as watched. The next trace awaits.'); });
    disposers.push(audio.watchVideo(video));
    videos.push(video);
    const watched = !isTeaser ? el('button', { type: 'button', class: 'button', 'aria-pressed': String(Boolean(saved.watched)), text: t(saved.watched ? '✓ شاهدته' : 'علّم: شاهدته', saved.watched ? '✓ Watched' : 'Mark as watched'), onClick: () => {
      const progress = getProgress(item.progressId); progress.watched = !progress.watched; store.set('episode:' + item.progressId, progress);
      watched.setAttribute('aria-pressed', String(progress.watched)); watched.textContent = t(progress.watched ? '✓ شاهدته' : 'علّم: شاهدته', progress.watched ? '✓ Watched' : 'Mark as watched');
    } }) : null;
    root.append(el('section', { class: `section theater-page${isTeaser ? ' zarqa-page' : ''}` }, [
      el('a', { class: 'back-link', href: services.routeURL(isTeaser ? '' : 'raven-17/'), text: t('← إلى الأعمال', '← Back to films') }),
      eyebrow(isTeaser ? 'إعلان تشويقي · قيد التطوير' : 'RAVEN 17 · السلسلة الأصلية', isTeaser ? 'TEASER · IN DEVELOPMENT' : 'RAVEN 17 · ORIGINAL SERIES'),
      el('h1', { text: partLabel }),
      el('p', { class: 'section-lead', text: isTeaser ? t('بين الرؤية والدليل.', 'Between vision and evidence.') : t('استمتع بالمشاهدة. تُحفظ نقطة توقفك هنا.', 'Enjoy the film. Your place is saved here.') }),
      el('div', { class: 'theater-frame' }, [video]),
      el('div', { class: 'theater-controls' }, [playButton, el('button', { type: 'button', class: 'button', 'data-media-start': 'true', text: t('من البداية ↻', 'Restart ↻'), onClick: () => play(true) }), watched]), status,
      el('a', { class: 'direct-video-link', href: item.src, target: '_blank', rel: 'noopener noreferrer', text: t('افتح الفيديو مباشرة →', 'Open the video directly →'), onClick: () => video.pause() }),
      isTeaser ? el('div', { class: 'upcoming-follow' }, [el('span', { class: 'status-stamp', text: t('قيد التطوير', 'IN DEVELOPMENT') }),
        el('p', { text: t('تابع أخبار الفيلم على حساب RAVEN الرسمي.', 'Follow RAVEN for news of the film.') }),
        el('a', { class: 'button primary', href: 'https://www.tiktok.com/@iid7oom211', target: '_blank', rel: 'noopener noreferrer', text: t('تابع أخبار الإطلاق →', 'Follow release updates →') }),
      ]) : el('nav', { class: 'part-navigation', 'aria-label': t('أجزاء الفيلم', 'Film chapters') }, EPISODES.map(ep => el('a', {
        href: services.routeURL(`raven-17/part-${ep.id}/`), 'aria-current': ep.id === item.id ? 'page' : undefined, text: t(ep.labelAr, ep.labelEn),
      }))),
    ]));
    disposers.push(() => { save(); disposed = true; audio.release(startHold); });
  }

  if (!route) home();
  else if (route === 'raven-17') { document.title = 'RAVEN 17 | RAVEN'; root.append(filmsSection(true)); }
  else if (route === 'zarqa') theater(ZARQA, true);
  else if (/^raven-17\/part-[1-2]$/.test(route)) theater(EPISODES[Number(route.at(-1)) - 1]);
  else { document.title = t('ملف مفقود | RAVEN', 'Missing file | RAVEN'); root.append(el('section', { class: 'section error-page' }, [eyebrow('404 · الأرشيف', '404 · ARCHIVE'), el('h1', { text: t('هذا الملف مفقود من الأرشيف.', 'This file is missing from the archive.') }), link('', 'عد إلى الرئيسية', 'Return home', true)])); }
  return () => { disposers.forEach(dispose => dispose()); videos.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); }); };
}

function formatTime(seconds) { const n = Math.max(0, Math.floor(Number(seconds) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }
