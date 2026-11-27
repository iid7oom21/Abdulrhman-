import { shots } from './evidence.mjs';

export const DURATION = 30_000;
export const CUT_LENGTH = 3;
const required = shots.filter(shot => shot.proof);

// Read the deadline at the gesture as well as on display ticks: a throttled
// interval must never let a late submission through. Time is monotonic.
export function createEditingRound(now = () => performance.now()) {
  let phase = 'briefing', remaining = DURATION, deadline = 0;
  const selection = new Set();
  function tick() {
    if (phase !== 'editing') return;
    remaining = Math.max(0, deadline - now());
    if (!remaining) phase = 'expired';
  }
  function canSubmit() {
    return phase === 'editing' && selection.size === CUT_LENGTH &&
      !shots.some(shot => shot.protected && selection.has(shot.id));
  }
  return {
    read() {
      tick();
      return { phase, remaining, selected: [...selection], canSubmit: canSubmit() };
    },
    start() {
      if (phase === 'editing' || phase === 'paused') return;
      selection.clear();
      remaining = DURATION;
      deadline = now() + remaining;
      phase = 'editing';
    },
    toggle(id) {
      tick();
      if (phase !== 'editing' || !shots.some(shot => shot.id === id)) return;
      if (selection.has(id)) selection.delete(id);
      else if (selection.size < CUT_LENGTH) selection.add(id);
    },
    submit() {
      tick();
      if (canSubmit()) phase = required.every(shot => selection.has(shot.id)) ? 'proved' : 'incomplete';
    },
    pause() {
      tick();
      if (phase === 'editing') phase = 'paused';
    },
    resume() {
      if (phase !== 'paused') return;
      deadline = now() + remaining;
      phase = 'editing';
    },
  };
}
