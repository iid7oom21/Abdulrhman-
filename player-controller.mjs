/**
 * RAVEN Isolated Audio Player Controller Experiment
 *
 * Contains:
 * 1. `createLegacyPlayer(audio, tracks)` — The simplified original model with intentional
 *    async race bugs (used in tests to prove the failure modes before the fix).
 * 2. `createPlayer(audio, tracks)` — The fixed controller that separates user intent
 *    (`desiredPlaying`), in-flight playback (`pending` / `status === 'loading'`),
 *    and confirmed playback (`playing` / `status === 'playing'`), while guarding
 *    against stale Promise settlements via a monotonic `operationId`.
 */

export function createLegacyPlayer(audio, tracks) {
  let index = 0;
  let playing = false;

  audio.src = tracks[index].src;

  async function play() {
    await audio.play();
    playing = true;
  }

  function pause() {
    audio.pause();
    playing = false;
  }

  function toggle() {
    if (playing) {
      pause();
    } else {
      return play();
    }
  }

  function select(nextIndex) {
    const resume = playing;
    pause();
    index = nextIndex;
    audio.src = tracks[index].src;

    if (resume) {
      return play();
    }
  }

  return {
    play,
    pause,
    toggle,
    select,
    next: () => select((index + 1) % tracks.length),
    previous: () => select((index - 1 + tracks.length) % tracks.length),
    getState: () => ({ index, playing })
  };
}

function normalizeError(err) {
  if (err instanceof Error) {
    return err;
  }
  return new Error(typeof err === 'string' ? err : 'Playback failed');
}

export function createPlayer(audio, tracks) {
  if (!audio || typeof audio.play !== 'function' || typeof audio.pause !== 'function') {
    throw new TypeError('A valid audio object with play() and pause() methods is required.');
  }

  if (!Array.isArray(tracks)) {
    throw new TypeError('Tracks must be an array.');
  }

  if (tracks.length === 0) {
    throw new RangeError('Track list must not be empty.');
  }

  const trackList = tracks.map((track, idx) => {
    if (!track || typeof track.src !== 'string' || track.src.trim() === '') {
      throw new TypeError(`Track at index ${idx} must have a non-empty string "src".`);
    }
    return { ...track };
  });

  let index = 0;
  let status = 'paused'; // 'paused' | 'loading' | 'playing' | 'error' | 'disposed'
  let desiredPlaying = false;
  let error = null;
  let disposed = false;
  let operationId = 0;
  let activePlayPromise = null;

  audio.src = trackList[index].src;

  function handleEnded() {
    if (disposed || !desiredPlaying || status !== 'playing') {
      return;
    }
    const nextIndex = (index + 1) % trackList.length;
    select(nextIndex);
  }

  if (typeof audio.addEventListener === 'function') {
    audio.addEventListener('ended', handleEnded);
  }

  function play() {
    if (disposed) {
      return Promise.resolve(false);
    }

    if (status === 'playing') {
      return Promise.resolve(true);
    }

    if (status === 'loading' && activePlayPromise !== null) {
      return activePlayPromise;
    }

    operationId += 1;
    const currentOp = operationId;
    desiredPlaying = true;
    status = 'loading';
    error = null;

    if (audio.src !== trackList[index].src) {
      audio.src = trackList[index].src;
    }

    let rawResult;
    try {
      rawResult = audio.play();
    } catch (syncError) {
      if (!disposed && operationId === currentOp) {
        desiredPlaying = false;
        status = 'error';
        error = normalizeError(syncError);
        activePlayPromise = null;
      }
      return Promise.resolve(false);
    }

    const trackedPromise = Promise.resolve(rawResult).then(
      () => {
        if (disposed || operationId !== currentOp) {
          return false;
        }
        activePlayPromise = null;
        status = 'playing';
        desiredPlaying = true;
        error = null;
        return true;
      },
      (asyncError) => {
        if (disposed || operationId !== currentOp) {
          return false;
        }
        activePlayPromise = null;
        desiredPlaying = false;
        status = 'error';
        error = normalizeError(asyncError);
        return false;
      }
    );

    activePlayPromise = trackedPromise;
    return trackedPromise;
  }

  function pause() {
    if (disposed) {
      return;
    }
    operationId += 1;
    activePlayPromise = null;
    desiredPlaying = false;
    status = 'paused';
    error = null;
    audio.pause();
  }

  function toggle() {
    if (disposed) {
      return Promise.resolve(false);
    }
    if (desiredPlaying) {
      pause();
      return Promise.resolve(false);
    }
    return play();
  }

  function select(nextIndex) {
    if (disposed) {
      return Promise.resolve(false);
    }

    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= trackList.length) {
      throw new RangeError(
        `Invalid track index: ${String(nextIndex)}. Expected an integer between 0 and ${trackList.length - 1}.`
      );
    }

    const shouldResume = desiredPlaying;
    operationId += 1;
    activePlayPromise = null;
    audio.pause();

    index = nextIndex;
    audio.src = trackList[index].src;
    error = null;
    desiredPlaying = false;
    status = 'paused';

    if (shouldResume) {
      return play();
    }

    return Promise.resolve(false);
  }

  function next() {
    if (disposed) {
      return Promise.resolve(false);
    }
    return select((index + 1) % trackList.length);
  }

  function previous() {
    if (disposed) {
      return Promise.resolve(false);
    }
    return select((index - 1 + trackList.length) % trackList.length);
  }

  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    operationId += 1;
    activePlayPromise = null;
    desiredPlaying = false;
    status = 'disposed';
    error = null;

    if (typeof audio.removeEventListener === 'function') {
      audio.removeEventListener('ended', handleEnded);
    }

    audio.pause();
  }

  function getState() {
    return {
      index,
      playing: status === 'playing',
      pending: status === 'loading',
      desiredPlaying,
      status,
      error,
      disposed,
      operationId,
      trackCount: trackList.length,
      src: trackList[index].src
    };
  }

  return {
    play,
    pause,
    toggle,
    select,
    next,
    previous,
    dispose,
    getState
  };
}
