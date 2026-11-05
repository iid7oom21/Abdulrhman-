/* One locale controller shared by the static pages and their interactive views. */
(function () {
  'use strict';
  const root = document.documentElement;
  const subscribers = new Set();
  const valid = value => value === 'en' || value === 'ar';
  const pages = new Set(['/', '/case', '/watch', '/privacy', '/404']);
  const homepage = new URL('../', document.currentScript.src).pathname;
  // Handoff v2: the former /case route now resolves to the homepage.
  const casePath = homepage;
  const originalOrigin = 'https://project25762.websitepublisher.ai';
  const publicPath = path => path.replace(/(?:index|content)\.html$/, '').replace(/\/?$/, '/');
  function pagePath(path) {
    let value = path.replace(/\/+$/, '') || '/';
    value = value.replace(/\.html$/, '');
    if (value === '/index') value = '/';
    if (value === '/en') return '/';
    if (value.startsWith('/en/')) value = value.slice(3);
    if (value === '/index') value = '/';
    return value;
  }
  function route(path, locale) {
    const chosen = valid(locale) ? locale : current;
    const url = new URL(path, new URL(homepage, location.origin));
    if (url.origin !== location.origin && url.origin !== originalOrigin) return path;
    // Forms stay on their original host, including when their link is translated.
    if (url.origin === originalOrigin && url.hash === '#raven-collaborate') return path;
    const page = pagePath(url.pathname);
    if (page === '/case' || publicPath(url.pathname) === casePath) {
      url.pathname = casePath;
      url.searchParams.delete('lang');
      return url.pathname + url.search + url.hash;
    }
    if (page === '/' || publicPath(url.pathname) === homepage) {
      url.pathname = homepage;
      if (chosen === 'en') url.searchParams.set('lang', 'en');
      else url.searchParams.delete('lang');
      return url.pathname + url.search + url.hash;
    }
    if (!pages.has(page)) return path;
    url.pathname = page === '/404' ? '/404.html' : chosen === 'en' ? '/en' + (page === '/' ? '' : page) : page;
    url.searchParams.delete('lang');
    if (page === '/404' && chosen === 'en') url.searchParams.set('lang', 'en');
    return originalOrigin + url.pathname + url.search + url.hash;
  }
  function fromUrl() {
    const url = new URL(location.href);
    const legacy = url.searchParams.get('lang');
    if (valid(legacy)) return legacy;
    if (/^\/en(?:\.html|\/|$)/.test(url.pathname)) return 'en';
    if (pages.has(pagePath(url.pathname)) || [homepage, casePath].includes(publicPath(url.pathname))) return 'ar';
    return valid(root.dataset.ravenLocale) ? root.dataset.ravenLocale : 'ar';
  }
  let current = fromUrl();
  function updateHead() {
    const payload = document.getElementById('raven-page-metadata');
    if (!payload) return;
    let meta;
    try { meta = JSON.parse(payload.textContent)[current]; } catch (_) { return; }
    if (!meta) return;
    if (meta.title) document.title = meta.title;
    [['meta[name="description"]', 'content', meta.description],
      ['meta[property="og:title"]', 'content', meta.title],
      ['meta[property="og:description"]', 'content', meta.description],
      ['meta[property="og:url"]', 'content', meta.url],
      ['meta[property="og:locale"]', 'content', current === 'en' ? 'en_US' : 'ar_SA'],
      ['meta[name="twitter:title"]', 'content', meta.title],
      ['meta[name="twitter:description"]', 'content', meta.description],
      ['link[rel="canonical"]', 'href', meta.url]].forEach(([selector, attr, value]) => {
        if (value) document.querySelector(selector)?.setAttribute(attr, value);
      });
    document.querySelectorAll('script[type="application/ld+json"]').forEach(node => {
      let data;
      try { data = JSON.parse(node.textContent); } catch (_) { return; }
      if (data['@type'] !== 'WebSite') return;
      data.url = meta.url;
      data.inLanguage = current;
      data.description = meta.description;
      node.textContent = JSON.stringify(data);
    });
  }
  function updateLinks() {
    document.querySelectorAll('a[href]').forEach(link => {
      const locale = link.dataset.ravenLanguage || link.dataset.rvnLang || link.dataset.caseLanguage;
      if (valid(locale)) {
        link.href = route(location.pathname + location.search + location.hash, locale);
        link.setAttribute('hreflang', locale);
        link.setAttribute('aria-label', locale === 'en' ? 'Read in English' : 'اقرأ بالعربية');
        return;
      }
      const original = link.dataset.ravenRoute || link.dataset.rvnRoute || link.getAttribute('href');
      if (original && !original.startsWith('#')) {
        const target = route(original, current);
        if (target !== original || link.dataset.ravenRoute) {
          link.dataset.ravenRoute = original;
          link.setAttribute('href', target);
        }
      }
    });
  }
  function apply(locale, updateUrl) {
    if (!valid(locale)) return;
    const changed = current !== locale;
    current = locale;
    root.lang = locale;
    root.dir = locale === 'en' ? 'ltr' : 'rtl';
    root.dataset.ravenLocale = locale;
    try { localStorage.setItem('raven_language', locale); } catch (_) {}
    if (updateUrl) {
      history.replaceState(history.state, '', route(location.pathname + location.search + location.hash, locale));
    }
    updateHead();
    updateLinks();
    if (changed) {
      subscribers.forEach(callback => callback(locale));
      document.dispatchEvent(new CustomEvent('raven:language', { detail: { language: locale } }));
    }
  }
  window.RavenI18n = {
    language: () => current,
    route,
    setLanguage: (locale, options = {}) => apply(locale, options.updateUrl === true),
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); }
  };
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-raven-language]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    apply(link.dataset.ravenLanguage, true);
  });
  window.addEventListener('popstate', () => apply(fromUrl(), false));
  apply(current, new URL(location.href).searchParams.has('lang'));
})();
