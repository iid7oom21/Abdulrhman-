import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditingRound, DURATION } from '../raven/after-show/round.mjs';
import { shots } from '../raven/after-show/evidence.mjs';

function fixture() {
  let time = 0;
  return { round: createEditingRound(() => time), advance: ms => { time += ms; } };
}

test('the briefing consumes no time; only three distinct valid frames fit, with reversible edits', () => {
  const { round, advance } = fixture();
  advance(100_000); round.toggle(3); round.submit();
  assert.deepEqual(round.read(), { phase: 'briefing', remaining: DURATION, selected: [], canSubmit: false });
  round.start(); [5, 3].forEach(round.toggle); round.submit();
  assert.equal(round.read().phase, 'editing');
  [1, 4, 99].forEach(round.toggle);
  assert.deepEqual(round.read().selected, [5, 3, 1]);
  round.toggle(3); round.toggle(4);
  assert.deepEqual(round.read().selected, [5, 1, 4]);
});

test('all ordered edits: 1/3/5 prove the lie, other safe cuts fail, protected cuts stay editable', () => {
  assert.deepEqual(shots.map(s => s.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const a of shots) for (const b of shots) for (const c of shots) {
    const ids = [a.id, b.id, c.id];
    if (new Set(ids).size !== 3) continue;
    const { round } = fixture(); round.start(); ids.forEach(round.toggle); round.submit();
    const expected = ids.includes(8) ? 'editing' : [1, 3, 5].every(id => ids.includes(id)) ? 'proved' : 'incomplete';
    assert.equal(round.read().phase, expected, ids.join('/'));
  }
});

test('removing the withheld shot unlocks submission; submitting freezes the cut and replay clears it', () => {
  const { round, advance } = fixture(); round.start(); [1, 8, 3].forEach(round.toggle); round.submit();
  assert.equal(round.read().canSubmit, false); advance(4_000);
  [8, 5].forEach(round.toggle); round.submit(); round.toggle(2); advance(40_000);
  assert.deepEqual(round.read(), { phase: 'proved', remaining: 26_000, selected: [1, 3, 5], canSubmit: false });
  round.start(); assert.deepEqual(round.read(), { phase: 'editing', remaining: 30_000, selected: [], canSubmit: false });
});

test('the deadline applies to input even without a display tick', () => {
  for (const delay of [29_999, 30_000, 45_000]) {
    const { round, advance } = fixture(); round.start(); [1, 3, 5].forEach(round.toggle); advance(delay); round.submit();
    assert.equal(round.read().phase, delay < 30_000 ? 'proved' : 'expired');
    if (delay >= 30_000) assert.equal(round.read().remaining, 0);
  }
});

test('hiding the page freezes the exact remaining time and cut without restarting or extending the round', () => {
  const { round, advance } = fixture(); round.start(); round.toggle(5); advance(7_225); round.pause();
  advance(90_000); round.start(); round.toggle(1); round.submit(); round.pause();
  assert.deepEqual(round.read(), { phase: 'paused', remaining: 22_775, selected: [5], canSubmit: false });
  round.resume(); advance(2_000); round.resume(); round.start(); advance(20_775); round.toggle(1);
  assert.deepEqual(round.read(), { phase: 'expired', remaining: 0, selected: [5], canSubmit: false });
});
