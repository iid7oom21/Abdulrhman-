import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameLoader } from '../site-loading.js';

const home = new URL('https://raven.test/raven/content.html#top');
const game = new URL('after-show/index.html?lang=en', home);

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requests = [], states = [], departures = [];
  const frame = {
    contentDocument: { readyState: 'complete' },
    contentWindow: { location: { replace: href => requests.push(href) } },
  };
  const loader = createFrameLoader(frame, {
    onLeave: doc => departures.push(doc),
    onStateChange: (state, url) => states.push([state, url?.href]),
  });
  return { frame, loader, requests, states, departures };
}

test('archive and game share one handoff; only the incoming ready document completes it', t => {
  const { frame, loader, requests, states, departures } = fixture(t);
  for (const url of [home, game, home]) {
    const previous = frame.contentDocument;
    loader.open(url);
    assert.deepEqual(states.at(-1), ['loading', url.href]);
    assert.equal(departures.at(-1), previous);
    assert.equal(loader.isCurrent(previous), false);
    assert.equal(loader.accept(previous), false);
    const next = frame.contentDocument = { readyState: 'loading' };
    assert.equal(loader.accept(next), false);
    next.readyState = 'interactive';
    assert.equal(loader.accept(next), true);
    assert.equal(loader.isCurrent(next), true);
    assert.equal(loader.accept(previous), false);
    assert.equal(loader.accept(next), true); // A language sync isn't another arrival.
    t.mock.timers.tick(12_000);
    assert.deepEqual(states.at(-1), ['ready', undefined]);
  }
  assert.deepEqual(requests, [home.href, game.href, home.href]);
  assert.equal(states.length, 6);
});

test('updates to a pending route retain the latest direct link without resetting its deadline', t => {
  const { frame, loader, requests, states } = fixture(t);
  loader.open(game);
  t.mock.timers.tick(11_999);
  const latest = new URL('?lang=ar#briefing', game);
  loader.open(latest);
  assert.deepEqual(states.at(-1), ['loading', latest.href]);
  t.mock.timers.tick(1);
  assert.deepEqual(states.at(-1), ['failed', latest.href]);
  assert.deepEqual(requests, [game.href]);
  // A slow document may still become ready without the visitor having to retry.
  assert.equal(loader.accept(frame.contentDocument = { readyState: 'complete' }), true);
  assert.deepEqual(states.at(-1), ['ready', undefined]);
});

test('replacing or retrying a load gives only the latest attempt a recovery deadline', t => {
  const { frame, loader, requests, states } = fixture(t);
  loader.open(home);
  t.mock.timers.tick(8_000);
  loader.open(game);
  t.mock.timers.tick(4_000);
  assert.deepEqual(states.at(-1), ['loading', game.href]);
  t.mock.timers.tick(8_000);
  assert.deepEqual(states.at(-1), ['failed', game.href]);
  const failedDocument = frame.contentDocument = { readyState: 'complete' };
  loader.open(game, { reload: true });
  assert.deepEqual(states.at(-1), ['loading', game.href]);
  assert.equal(loader.accept(failedDocument), false);
  assert.equal(loader.accept(frame.contentDocument = { readyState: 'interactive' }), true);
  t.mock.timers.tick(12_000);
  assert.deepEqual(states.map(([state]) => state), ['loading', 'loading', 'failed', 'loading', 'ready']);
  assert.deepEqual(requests, [home.href, game.href, game.href]);
});
