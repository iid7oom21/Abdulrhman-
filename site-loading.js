// A frame load is complete when its child bridge is ready, not when the iframe
// fires `load` (which also happens for error documents).
export function createFrameLoader(frame, { onLeave, onStateChange }) {
  let activeDocument = null;
  let pending = null;

  function isCurrent(source = frame.contentDocument) {
    return Boolean(source && source === activeDocument && source === frame.contentDocument);
  }

  function open(content, { reload = false } = {}) {
    // Query/hash changes need the latest destination, not another document or deadline.
    if (!reload && pending?.content.pathname === content.pathname) {
      pending.content = content;
      onStateChange(pending.state, content);
      return;
    }
    clearTimeout(pending?.timer);
    const attempt = { content, departing: frame.contentDocument, state: 'loading' };
    pending = attempt;
    activeDocument = null;
    onLeave(attempt.departing);
    onStateChange('loading', content);
    attempt.timer = setTimeout(() => {
      if (pending !== attempt) return;
      attempt.state = 'failed';
      onStateChange('failed', attempt.content);
    }, 12_000);
    frame.contentWindow.location.replace(content.href);
  }

  function accept(source) {
    if (!source || source !== frame.contentDocument || source === pending?.departing ||
        source.readyState === 'loading') return false;
    if (!isCurrent(source)) {
      clearTimeout(pending?.timer);
      pending = null;
      activeDocument = source;
      onStateChange('ready');
    }
    return true;
  }

  return { open, accept, isCurrent };
}
