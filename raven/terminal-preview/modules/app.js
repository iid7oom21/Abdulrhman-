import { BASE, el, routeURL, createStore } from './core.js?v=abc27e4aad89ec10';
import { createAudio } from './audio.js?v=abc27e4aad89ec10';
import { createOpening } from './opening.js?v=abc27e4aad89ec10';

const outlet = document.querySelector('#route-outlet');
const notices = document.querySelector('#site-notice');
let noticeTimer;
function notify(message) {
  notices.textContent = message;
  notices.classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notices.classList.remove('visible'), 5500);
}
const store = createStore(() => notify('الحفظ الدائم غير متاح؛ يمكنك متابعة التجربة في هذه الزيارة.'));
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const params = new URL(location.href).searchParams;
let lang = params.get('lang') === 'en' ? 'en' : params.get('lang') === 'ar' ? 'ar' : store.get('language', 'ar');
if (!['ar', 'en'].includes(lang)) lang = 'ar';
const services = {
  store, notify, lang,
  t: (ar, en) => services.lang === 'en' ? en : ar,
  routeURL: path => {
    const u = new URL(routeURL(path));
    if (services.lang === 'en') u.searchParams.set('lang', 'en');
    return u.href;
  },
  motionAllowed: () => !motionQuery.matches && !store.get('quiet', false) && !navigator.connection?.saveData,
  navigate: (path, options = {}) => navigate(path, options),
};
services.audio = createAudio(document.querySelector('#audio-dock'), services);
services.opening = createOpening(services);
let cleanup = () => {};
let routeGeneration = 0;
let currentURL = location.href;
const styleLoads = new Map();
const releaseVersion = new URL(import.meta.url).searchParams.get('v');
function stylesheet(name) {
  if (!styleLoads.has(name)) {
    const url = new URL(name, import.meta.url);
    if (releaseVersion) url.searchParams.set('v', releaseVersion);
    const link = el('link', { rel: 'stylesheet', href: url.href });
    const ready = new Promise(resolve => { link.addEventListener('load', resolve, { once: true }); link.addEventListener('error', resolve, { once: true }); });
    document.head.append(link); styleLoads.set(name, ready);
  }
  return styleLoads.get(name);
}

// A failed ESM link stays cached for this document. Retrying needs a fresh
// document/module map; do not clear saved film progress or music preferences.
function reloadRoute() {
  const url = new URL(location.href);
  url.searchParams.set('_reload', Date.now().toString(36));
  location.replace(url.href);
}

function renderHeader() {
  const t = services.t;
  const relative = location.pathname.slice(BASE.pathname.length);
  document.documentElement.lang = services.lang;
  document.documentElement.dir = services.lang === 'en' ? 'ltr' : 'rtl';
  document.documentElement.classList.toggle('quiet-mode', !services.motionAllowed());
  document.querySelector('#site-header').replaceChildren(
    el('a', { class: 'brand', href: services.routeURL(''), 'aria-label': 'RAVEN — ' + t('الرئيسية', 'Home') }, [
      el('span', { class: 'brand-word', text: 'RAVEN', dir: 'ltr' }), el('span', { class: 'brand-caption', text: t('كل حكاية تترك أثرًا', 'EVERY STORY LEAVES A TRACE') }),
    ]),
    el('nav', { class: 'primary-nav', 'aria-label': t('التنقل الرئيسي', 'Main navigation') }, [
      ...[['raven-17/', 'الأفلام', 'Films'], ['zarqa/', 'قريبًا', 'Coming soon']].map(([path, ar, en]) =>
        el('a', { href: services.routeURL(path), text: t(ar, en), 'aria-current': relative.startsWith(path) ? 'page' : undefined })),
    ]),
    el('div', { class: 'header-settings' }, [
      el('button', { type: 'button', class: 'language-button', text: services.lang === 'ar' ? 'EN' : 'عربي', 'aria-label': t('Switch to English', 'التبديل للعربية'), onClick: () => {
        const u = new URL(location.href); u.searchParams.set('lang', services.lang === 'ar' ? 'en' : 'ar'); navigate(u.href);
      } }),
      el('button', { type: 'button', class: 'quiet-button', text: t('واجهة هادئة', 'Quiet view'), 'aria-pressed': String(store.get('quiet', false)), onClick: () => {
        store.set('quiet', !store.get('quiet', false)); renderHeader();
        if (!services.motionAllowed()) document.querySelectorAll('video[data-ambient-video]').forEach(v => v.pause());
      } }),
    ]),
  );
  document.querySelector('#skip-link').textContent = t('انتقل إلى المحتوى', 'Skip to content');
  document.querySelector('#site-footer').replaceChildren(
    el('span', { class: 'footer-brand', text: 'RAVEN', dir: 'ltr' }),
    el('p', { text: t('عالم سينمائي من صنع عبدالرحمن العتيبي.', 'A cinematic world by Abdulrahman Alotaibi.') }),
    el('div', { class: 'footer-links' }, [
      el('a', { href: 'https://www.tiktok.com/@iid7oom211', target: '_blank', rel: 'noopener noreferrer', text: 'TikTok →' }),
      el('a', { href: 'https://www.instagram.com/iid7oom211/', target: '_blank', rel: 'noopener noreferrer', text: 'Instagram →' }),
      el('a', { href: 'https://project25762.websitepublisher.ai/#raven-collaborate', target: '_blank', rel: 'noopener noreferrer', text: t('التعاون والتواصل →', 'Collaborate →') }),
    ]),
  );
  services.audio.refreshLanguage?.();
}

function normalizeEpisodeURL(u) {
  // The former third film is now Part Two. Keep old links inside the same
  // document/audio owner and retain their language, query and fragment.
  if (u.origin === BASE.origin && u.pathname.startsWith(BASE.pathname) && u.pathname.slice(BASE.pathname.length).replace(/index\.html$/, '').replace(/\/+$/, '') === 'raven-17/part-3') {
    u.pathname = new URL('raven-17/part-2/', BASE).pathname;
  }
  return u;
}

async function renderRoute({ restoreY, focus = true } = {}) {
  const generation = ++routeGeneration;
  cleanup(); cleanup = () => {};
  const u = normalizeEpisodeURL(new URL(location.href));
  if (u.href !== location.href) {
    history.replaceState(history.state, '', u);
    currentURL = u.href;
  }
  services.lang = u.searchParams.get('lang') === 'en' ? 'en' : u.searchParams.get('lang') === 'ar' ? 'ar' : store.get('language', 'ar');
  store.set('language', services.lang);
  renderHeader();
  const relative = u.pathname.slice(BASE.pathname.length).replace(/index\.html$/, '').replace(/\/+$/, '');
  outlet.setAttribute('aria-busy', 'true');
  outlet.replaceChildren(el('div', { class: 'route-loading', role: 'status', text: services.t('نفتح الملف…', 'Opening the file…') }));
  try {
    const module = await import('./home.js?v=abc27e4aad89ec10');
    if (generation !== routeGeneration) return;
    outlet.replaceChildren(); cleanup = module.mount(outlet, services, relative) || (() => {});
  } catch (error) {
    if (generation !== routeGeneration) return;
    console.error('RAVEN route failed', error);
    outlet.replaceChildren(el('section', { class: 'error-page' }, [el('p', { class: 'eyebrow', text: 'RAVEN / ARCHIVE' }),
      el('h1', { text: services.t('تعذّر فتح الملف', 'The file could not be opened') }),
      el('p', { text: services.t('أعد المحاولة. تقدمك المحفوظ يبقى معك.', 'Try again. Your saved progress is retained.') }),
      el('button', { type: 'button', class: 'button primary', text: services.t('أعد المحاولة', 'Retry'), onClick: reloadRoute }),
      el('a', { class: 'button', href: services.routeURL(''), text: services.t('إلى الرئيسية', 'Go home') }),
    ]));
  } finally {
    if (generation === routeGeneration) {
      outlet.removeAttribute('aria-busy');
      const shortHeading = outlet.querySelector('.eyebrow');
      if (services.motionAllowed() && shortHeading && shortHeading.textContent.length < 60) {
        shortHeading.classList.add('typewriter-heading');
        document.dispatchEvent(new CustomEvent('raven:typewrite'));
      }
      requestAnimationFrame(() => {
        if (restoreY !== undefined) scrollTo(0, restoreY);
        else if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
        else scrollTo(0, 0);
        if (focus) { const heading = outlet.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }
      });
    }
  }
}

function navigate(path, { replace = false } = {}) {
  services.opening.hide({ focus: false });
  const next = normalizeEpisodeURL(new URL(path.startsWith('http') || path.startsWith('/') ? path : services.routeURL(path), location.href));
  if (next.origin !== location.origin || !next.pathname.startsWith(BASE.pathname)) { location.href = next.href; return; }
  if (!next.searchParams.has('lang') && services.lang === 'en') next.searchParams.set('lang', 'en');
  history.replaceState({ ...history.state, scrollY: window.scrollY }, '', location.href);
  if (next.pathname === location.pathname && next.search === location.search && next.hash !== location.hash) {
    history[replace ? 'replaceState' : 'pushState']({ scrollY: 0 }, '', next);
    currentURL = next.href;
    document.getElementById(decodeURIComponent(next.hash.slice(1)))?.scrollIntoView({ behavior: services.motionAllowed() ? 'smooth' : 'auto' });
    return;
  }
  history[replace ? 'replaceState' : 'pushState']({ scrollY: 0 }, '', next);
  currentURL = next.href; renderRoute();
}

document.addEventListener('click', event => {
  const a = event.target.closest('a[href]');
  if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || a.target || a.hasAttribute('download')) return;
  const target = new URL(a.href);
  if (target.origin !== location.origin || !target.pathname.startsWith(BASE.pathname)) return;
  event.preventDefault(); navigate(target.href);
});
history.scrollRestoration = 'manual';
window.addEventListener('popstate', () => {
  services.opening.hide({ focus: false });
  const previous = new URL(currentURL); const next = new URL(location.href); currentURL = next.href;
  if (previous.pathname === next.pathname && previous.search === next.search) { scrollTo(0, history.state?.scrollY || 0); return; }
  renderRoute({ restoreY: history.state?.scrollY || 0 });
});
motionQuery.addEventListener('change', () => { renderHeader(); if (!services.motionAllowed()) document.querySelectorAll('video[data-ambient-video]').forEach(v => v.pause()); });
const entryPath = location.pathname.slice(BASE.pathname.length).replace(/index\.html$/, '').replace(/\/+$/, '');
if (!entryPath) services.opening.show({ automatic: true });
renderRoute({ focus: false });
