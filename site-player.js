// The host owns one soundtrack while the content document changes.
import { createSoundtrack } from './site-audio.js?v=playlist-races-3';
import { createEntryGate } from './site-entry.js?v=intro-1';
import { createFrameLoader } from './site-loading.js';

const root = new URL('./', import.meta.url);
const contentVersion = new URL(import.meta.url).searchParams.get('v');
const archive = new URL('raven/', root);
// Allowlisted public directories and the standalone documents the shell loads.
const entries = new Map([
  [archive.pathname, 'content.html'],
  [new URL('after-show/', archive).pathname, 'index.html'],
]);
const frame = document.querySelector('#site-content');
const recovery = document.querySelector('#site-recovery');
const loadMessage = document.querySelector('#site-load-message');
const retry = document.querySelector('#site-retry');
const direct = document.querySelector('#site-direct');
const soundtrack = createSoundtrack(root);
const loader = createFrameLoader(frame, {
  onLeave(source) {
    soundtrack.setDepth?.(0, null);
    source?.querySelectorAll('audio, video').forEach(media => media.pause());
    soundtrack.setMediaActive(false);
  },
  onStateChange: renderLoading,
});
const pageMetadata = [
  'meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]',
  'link[rel="canonical"]', 'link[rel="alternate"][hreflang]',
  'script[type="application/ld+json"]'
].join(',');
let destination;
let restoring = false;
let reconciling = false;
let entryGate = null;

function route(value) {
  let url;
  try { url = new URL(value, location.href); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin) return null;
  const path = url.pathname.replace(/(?:index|content)\.html$/, '').replace(/\/?$/, '/');
  if (!entries.has(path)) return null;
  url.pathname = path;
  return url;
}

// Public URLs stay in the address bar; the frame's own history must be reloadable.
function contentUrl(value) {
  const url = route(value);
  if (url) url.pathname += entries.get(url.pathname);
  return url;
}

function renderLoading(state, content) {
  const loading = state === 'loading';
  frame.setAttribute('aria-busy', String(loading));
  recovery.hidden = state === 'ready';
  recovery.classList.toggle('is-loading', loading);
  retry.hidden = state !== 'failed';
  if (recovery.hidden) return;

  const english = content.searchParams.get('lang') === 'en';
  recovery.lang = english ? 'en' : 'ar';
  recovery.dir = english ? 'ltr' : 'rtl';
  loadMessage.textContent = loading
    ? (english ? 'Opening the page…' : 'جارٍ فتح الصفحة…')
    : (english ? 'The page could not finish loading.' : 'تعذّر إكمال تحميل الصفحة.');
  frame.title = loadMessage.textContent;
  retry.textContent = english ? 'Try again' : 'أعد المحاولة';
  direct.textContent = english ? 'Open the page directly' : 'افتح الصفحة مباشرة';
  direct.href = content.href;
}

function rememberView(child, view) {
  if (restoring || !loader.isCurrent() || child !== frame.contentWindow || !view) return;
  const x = Number.isFinite(view.x) ? view.x : 0;
  const y = Number.isFinite(view.y) ? view.y : 0;
  const focusId = typeof view.focusId === 'string' ? view.focusId : '';
  history.replaceState({ ...history.state, view: { x, y, focusId } }, '', location.href);
}

function saveView() {
  if (loader.isCurrent()) rememberView(frame.contentWindow, frame.contentWindow.RavenPage?.snapshot());
}

function updateHistory(url, push, childState = null, view = null) {
  history[push ? 'pushState' : 'replaceState']({ ravenShell: true, childState, view }, '', url);
}

function restoreChild() {
  restoring = true;
  frame.contentWindow.RavenPage.restore(
    destination.url.href, destination.childState, destination.view
  );
  // Let the child restore its scroll/focus before saving its next position.
  requestAnimationFrame(() => requestAnimationFrame(() => { restoring = false; }));
}

function show({ url, childState = null, view = null, focus = false }, { reload = false } = {}) {
  destination = { url, childState, view, focus };
  if (!reload && loader.isCurrent() && route(frame.contentWindow.location.href)?.pathname === url.pathname) {
    restoreChild();
    return;
  }
  const content = contentUrl(url);
  if (contentVersion) content.searchParams.set('v', contentVersion);
  loader.open(content, { reload });
}

function navigate(value) {
  const url = route(value);
  if (!url) return false;
  if (url.href === location.href) return true;
  saveView();
  updateHistory(url, true);
  show({ url, focus: true });
  return true;
}

function focusDestination(source) {
  // Let native fragment navigation and the shell agree on where focus belongs.
  let id = source.location.hash.slice(1);
  try { id = decodeURIComponent(id); } catch { /* Keep malformed fragment IDs literal. */ }
  const anchor = source.getElementById(id);
  const target = anchor?.getClientRects().length ? anchor : source.querySelector('main');
  if (!target) return;
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

window.RavenSite = {
  navigate,
  contentUrl,
  gesture: soundtrack.gesture,
  toggleMusic: soundtrack.toggleMusic,
  state: soundtrack.state,
  setMediaActive(child, source, active) {
    if (child === frame.contentWindow && source && loader.isCurrent(source)) soundtrack.setMediaActive(active);
  },
  setDepth(child, value) {
    if (child === frame.contentWindow && loader.isCurrent()) soundtrack.setDepth?.(value, frame.contentDocument);
  },
  pulse(child) {
    if (child === frame.contentWindow && loader.isCurrent()) soundtrack.pulse?.();
  },
  rememberView,
  childRoute(value, state, push = false) {
    const url = route(value);
    if (!loader.isCurrent() || url?.pathname !== destination.url.pathname) return;
    if (push) saveView();
    updateHistory(url, push, state, push ? null : history.state?.view);
    destination.url = url;
    destination.childState = state;
  },
  ready(child) {
    if (reconciling || child !== frame.contentWindow) return;
    const source = frame.contentDocument;
    if (!source || !child.RavenPage || route(child.location.href)?.pathname !== destination.url.pathname) return;
    const arrived = !loader.isCurrent(source);
    if (!loader.accept(source)) return;
    reconciling = true;
    try {
      if (arrived && (child.location.href !== contentUrl(destination.url).href ||
          destination.childState !== null || destination.view)) restoreChild();
      document.title = source.title;
      document.documentElement.lang = source.documentElement.lang;
      document.documentElement.dir = source.documentElement.dir;
      frame.title = source.title;
      document.head.querySelectorAll(pageMetadata).forEach(node => node.remove());
      source.head.querySelectorAll(pageMetadata).forEach(node => document.head.appendChild(node.cloneNode(true)));
      soundtrack.sync();
      entryGate?.sync();
      if (arrived && destination.focus && !destination.view &&
          !entryGate?.open && !document.activeElement?.closest('.site-player')) focusDestination(source);
    } finally { reconciling = false; }
  }
};

retry.addEventListener('click', () => show(destination, { reload: true }));
history.scrollRestoration = 'manual';
window.addEventListener('popstate', event => {
  const url = route(location.href);
  if (url) show({ url, childState: event.state?.childState, view: event.state?.view, focus: true });
});
const initial = route(location.href) || archive;
updateHistory(initial, false, history.state?.childState, history.state?.view);
show({ url: initial, childState: history.state?.childState, view: history.state?.view });
entryGate = createEntryGate({
  root,
  show: initial.pathname === archive.pathname && !initial.hash && !initial.searchParams.has('episode'),
  onEnter: soundtrack.enter,
  onClose() {
    destination.focus = true;
    if (loader.isCurrent()) focusDestination(frame.contentDocument);
  }
});
