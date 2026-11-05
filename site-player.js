// The host owns one soundtrack while the content document changes.
import { createSoundtrack } from './site-audio.js?v=playlist-races-3';
import { createEntryGate } from './site-entry.js?v=intro-1';

const root = new URL('./', import.meta.url);
const contentVersion = new URL(import.meta.url).searchParams.get('v');
const frame = document.querySelector('#site-content');
const recovery = document.querySelector('#site-recovery');
const loadMessage = document.querySelector('#site-load-message');
const retry = document.querySelector('#site-retry');
const direct = document.querySelector('#site-direct');
const soundtrack = createSoundtrack(root);
const routes = ['raven/'].map(path => new URL(path, root).pathname);
const pageMetadata = [
  'meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]',
  'link[rel="canonical"]', 'link[rel="alternate"][hreflang]',
  'script[type="application/ld+json"]'
].join(',');
let destination;
let loadedDocument = null;
let departingDocument = null;
let pendingPath = null;
let restoring = false;
let reconciling = false;
let loadTimer;
let loadFailed = false;
let entryGate = null;

function route(value) {
  let url;
  try { url = new URL(value, location.href); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin) return null;
  const path = url.pathname.replace(/(?:index|content)\.html$/, '').replace(/\/?$/, '/');
  if (!routes.includes(path)) return null;
  url.pathname = path;
  return url;
}

function currentChild() {
  try {
    return !pendingPath && loadedDocument && frame.contentDocument === loadedDocument;
  } catch { return false; }
}

function syncLoading() {
  const english = document.documentElement.lang === 'en';
  loadMessage.textContent = loadFailed
    ? (english ? 'The page could not finish loading.' : 'تعذّر إكمال تحميل الصفحة.')
    : (english ? 'Opening the page…' : 'جارٍ فتح الصفحة…');
  retry.textContent = english ? 'Try again' : 'أعد المحاولة';
  direct.textContent = english ? 'Open the page directly' : 'افتح الصفحة مباشرة';
}

function rememberView(child, view) {
  if (restoring || !currentChild() || child !== frame.contentWindow || !view) return;
  const x = Number.isFinite(view.x) ? view.x : 0;
  const y = Number.isFinite(view.y) ? view.y : 0;
  const focusId = typeof view.focusId === 'string' ? view.focusId : '';
  history.replaceState({ ...history.state, view: { x, y, focusId } }, '', location.href);
}

function saveView() {
  if (currentChild()) rememberView(frame.contentWindow, frame.contentWindow.RavenPage?.snapshot());
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

function show(url, childState = null, view = null, force = false, focus = false) {
  destination = { url, childState, view, focus };
  const content = new URL(url);
  content.pathname += 'content.html';
  if (contentVersion) content.searchParams.set('v', contentVersion);
  direct.href = content.href;
  if (!force && currentChild() && route(frame.contentWindow.location.href)?.pathname === url.pathname) {
    restoreChild();
    return;
  }
  // While a document is loading, retain the latest requested hash and query.
  if (!force && pendingPath === url.pathname) return;
  departingDocument = frame.contentDocument;
  soundtrack.setDepth?.(0, null);
  loadedDocument = null;
  pendingPath = url.pathname;
  departingDocument?.querySelectorAll('audio, video').forEach(media => media.pause());
  soundtrack.setMediaActive(false);
  frame.title = 'RAVEN — الرئيسية';
  loadFailed = false;
  retry.hidden = true;
  recovery.hidden = false;
  recovery.classList.add('is-loading');
  syncLoading();
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => {
    loadFailed = true;
    retry.hidden = false;
    recovery.classList.remove('is-loading');
    syncLoading();
  }, 12000);
  frame.contentWindow.location.replace(content.href);
}

function navigate(value) {
  const url = route(value);
  if (!url) return false;
  if (url.href === location.href) return true;
  saveView();
  updateHistory(url, true);
  show(url, null, null, false, true);
  return true;
}

window.RavenSite = {
  navigate,
  gesture: soundtrack.gesture,
  toggleMusic: soundtrack.toggleMusic,
  state: soundtrack.state,
  setMediaActive(child, source, active) {
    if (currentChild() && child === frame.contentWindow && source === loadedDocument) {
      soundtrack.setMediaActive(active);
    }
  },
  setDepth(child, value) {
    if (currentChild() && child === frame.contentWindow) soundtrack.setDepth?.(value, frame.contentDocument);
  },
  pulse(child) {
    if (currentChild() && child === frame.contentWindow) soundtrack.pulse?.();
  },
  rememberView,
  childRoute(value, state, push = false) {
    const url = route(value);
    if (!currentChild() || url?.pathname !== destination.url.pathname) return;
    if (push) saveView();
    updateHistory(url, push, state, push ? null : history.state?.view);
    destination.url = url;
    destination.childState = state;
  },
  ready(child) {
    if (reconciling || child !== frame.contentWindow) return;
    const source = child.document;
    if (source === departingDocument || source.readyState === 'loading' ||
        route(child.location.href)?.pathname !== destination.url.pathname || !child.RavenPage) return;
    reconciling = true;
    const arrived = source !== loadedDocument;
    loadedDocument = source;
    pendingPath = null;
    departingDocument = null;
    if (arrived && (child.location.href !== destination.url.href || destination.view)) restoreChild();
    document.title = source.title;
    document.documentElement.lang = source.documentElement.lang;
    document.documentElement.dir = source.documentElement.dir;
    frame.title = source.title;
    document.head.querySelectorAll(pageMetadata).forEach(node => node.remove());
    source.head.querySelectorAll(pageMetadata).forEach(node => document.head.appendChild(node.cloneNode(true)));
    clearTimeout(loadTimer);
    recovery.hidden = true;
    loadFailed = false;
    syncLoading();
    soundtrack.sync();
    entryGate?.sync();
    if (arrived && destination.focus && !destination.view &&
        !entryGate?.open && !document.activeElement?.closest('.site-player')) {
      const main = source.querySelector('main');
      if (main) {
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
    }
    reconciling = false;
  }
};

retry.addEventListener('click', () => show(destination.url, destination.childState, destination.view, true));
history.scrollRestoration = 'manual';
window.addEventListener('popstate', event => {
  const url = route(location.href);
  if (url) show(url, event.state?.childState, event.state?.view, false, true);
});
const initial = route(location.href) || new URL('raven/', root);
updateHistory(initial, false, history.state?.childState, history.state?.view);
show(initial, history.state?.childState, history.state?.view);
entryGate = createEntryGate({
  root,
  show: initial.pathname === routes[0] && !initial.hash && !initial.searchParams.has('episode'),
  onEnter: soundtrack.enter,
  onClose() {
    destination.focus = true;
    if (!currentChild()) return;
    const main = frame.contentDocument.querySelector('main');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }
});
