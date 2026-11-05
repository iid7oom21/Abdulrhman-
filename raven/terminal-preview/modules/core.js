// Shared helpers for the preview shell. Handoff v2: the investigation data and its saved-state readers were removed.
export const BASE = new URL('../', import.meta.url);
export const routeURL = path => new URL(String(path).replace(/^\//, ''), BASE).href;
export function el(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  }
  for (const child of [children].flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) element.append(child instanceof Node ? child : String(child));
  }
  return element;
}

export function createStore(onFailure = () => {}) {
  const prefix = 'raven-preview:v1:';
  const memory = new Map();
  let reported = false;
  function failed() { if (!reported) { reported = true; onFailure(); } }
  return {
    get(key, fallback = null) {
      if (memory.has(key)) return structuredClone(memory.get(key));
      try {
        const raw = localStorage.getItem(prefix + key);
        if (raw !== null) { const value = JSON.parse(raw); memory.set(key, value); return structuredClone(value); }
      } catch { failed(); }
      return structuredClone(fallback);
    },
    set(key, value) {
      memory.set(key, structuredClone(value));
      try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { failed(); }
    },
    prefix,
  };
}
