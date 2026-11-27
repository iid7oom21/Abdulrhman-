import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialScene, nextScene, PROPS } from '../raven/room-404/scene.mjs';

test('each prop advances one frame and only changes its own state', () => {
  const start = Object.freeze(initialScene());
  for (const prop of PROPS) {
    const next = nextScene(start, prop);
    assert.deepEqual(next, { ...start, frame: 2, [prop]: true });
    assert.notEqual(next, start);
  }
});

test('changes accumulate and the same prop can be toggled back', () => {
  const first = initialScene();
  const allActive = PROPS.reduce(nextScene, first);
  assert.deepEqual(allActive, { frame: 4, curtain: true, lamp: true, drawer: true });
  assert.deepEqual(nextScene(allActive, 'lamp'), { ...allActive, frame: 5, lamp: false });
  assert.deepEqual(initialScene(), first);
  assert.deepEqual(first, { frame: 1, curtain: false, lamp: false, drawer: false });
});

test('unknown objects do not advance the frame', () => {
  const start = initialScene();
  assert.equal(nextScene(start, 'door'), start);
});
