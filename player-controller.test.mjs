import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLegacyPlayer, createPlayer } from './player-controller.mjs';

/**
 * 14 synthetic mock tracks for deterministic controller testing only.
 * Note: These are NOT real audio files.
 */
const MOCK_14_TRACKS = Array.from({ length: 14 }, (_, i) => ({
  id: `track-${i + 1}`,
  title: `Mock Track ${i + 1} (Synthetic Test URI)`,
  src: `mock://raven-test-only/track-${String(i + 1).padStart(2, '0')}.mp3`
}));

/**
 * Deterministic FakeAudio test double.
 * - Records every play() and pause() call with sequence timestamps/Order and src snapshot.
 * - Provides manual resolve/reject handles for each pending play() Promise.
 * - Can simulate synchronous exceptions thrown directly inside play().
 * - Tracks event listeners and allows firing synthetic 'ended' events.
 * - Tracks src changes and internal paused/playing state.
 */
class FakeAudio {
  constructor() {
    this._src = '';
    this.srcHistory = [];
    this.paused = true;
    this.playCalls = [];
    this.pauseCalls = [];
    this.pendingRequests = [];
    this.events = [];
    this.listeners = new Map();
    this.syncErrorOnNextPlay = null;
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = value;
    this.srcHistory.push(value);
    this.events.push(`src:${value}`);
  }

  play() {
    const callIndex = this.playCalls.length;
    const srcAtCall = this._src;
    this.events.push(`play()#${callIndex + 1}[${srcAtCall}]`);

    if (this.syncErrorOnNextPlay) {
      const err = this.syncErrorOnNextPlay;
      this.syncErrorOnNextPlay = null;
      this.playCalls.push({ callIndex, src: srcAtCall, syncThrow: err });
      throw err;
    }

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const request = {
      callIndex,
      src: srcAtCall,
      settled: false,
      status: 'pending',
      resolve: () => {
        if (request.settled) return Promise.resolve();
        request.settled = true;
        request.status = 'resolved';
        this.paused = false;
        this.events.push(`resolve#${callIndex + 1}[${srcAtCall}]`);
        resolvePromise();
        return Promise.resolve();
      },
      reject: (err = new Error(`Play rejected for ${srcAtCall}`)) => {
        if (request.settled) return Promise.resolve();
        request.settled = true;
        request.status = 'rejected';
        this.paused = true;
        this.events.push(`reject#${callIndex + 1}[${srcAtCall}]`);
        rejectPromise(err);
        return Promise.resolve();
      },
      promise
    };

    this.playCalls.push(request);
    this.pendingRequests.push(request);
    return promise;
  }

  pause() {
    const callIndex = this.pauseCalls.length;
    const srcAtCall = this._src;
    this.paused = true;
    this.pauseCalls.push({ callIndex, src: srcAtCall });
    this.events.push(`pause()#${callIndex + 1}[${srcAtCall}]`);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(handler);
    }
  }

  listenerCount(type) {
    const set = this.listeners.get(type);
    return set ? set.size : 0;
  }

  emitEnded() {
    this.events.push(`ended[${this._src}]`);
    const set = this.listeners.get('ended');
    if (!set) return;
    for (const handler of [...set]) {
      handler();
    }
  }
}

describe('أولًا: إثبات العيوب في المصدر الأصلي (Legacy Bug Reproduction)', () => {
  test('عيب 1 (المصدر الأصلي): الضغط على تشغيل ثم toggle قبل اكتمال Promise الأول يستدعي play() مرتين وينتهي بحالة تشغيل بدل الإيقاف', async () => {
    const audio = new FakeAudio();
    const legacy = createLegacyPlayer(audio, MOCK_14_TRACKS);

    // 1. المستخدم يضغط تشغيل
    const p1 = legacy.play();
    assert.equal(audio.playCalls.length, 1);
    assert.deepEqual(legacy.getState(), { index: 0, playing: false });

    // 2. قبل اكتمال Promise الأول، المستخدم يضغط toggle لإيقاف التشغيل
    // لأن playing ما زالت false، يقوم المصدر الأصلي باستدعاء play() مرة ثانية بدل pause()!
    const p2 = legacy.toggle();

    assert.equal(audio.playCalls.length, 2, 'المصدر الأصلي استدعى play() مرتين بالخطأ');
    assert.equal(audio.pauseCalls.length, 0, 'المصدر الأصلي لم يستدعِ pause() إطلاقًا');

    // 3. عند اكتمال الوعود، تصبح الحالة النهائية playing: true رغم أن آخر أمر للمستخدم كان الإيقاف
    await audio.playCalls[0].resolve();
    await audio.playCalls[1].resolve();
    await Promise.all([p1, p2]);

    assert.deepEqual(legacy.getState(), { index: 0, playing: true });
    assert.deepEqual(audio.events, [
      `src:${MOCK_14_TRACKS[0].src}`,
      `play()#1[${MOCK_14_TRACKS[0].src}]`,
      `play()#2[${MOCK_14_TRACKS[0].src}]`,
      `resolve#1[${MOCK_14_TRACKS[0].src}]`,
      `resolve#2[${MOCK_14_TRACKS[0].src}]`
    ]);
  });

  test('عيب 2 (المصدر الأصلي): بدء تشغيل الأغنية الأولى ثم اختيار أغنية أخرى قبل اكتمال Promise يفقد نية التشغيل وتغيّر النتيجة القديمة الحالة', async () => {
    const audio = new FakeAudio();
    const legacy = createLegacyPlayer(audio, MOCK_14_TRACKS);

    // 1. بدء تشغيل الأغنية الأولى (index 0)
    const p1 = legacy.play();
    assert.equal(audio.playCalls.length, 1);
    assert.equal(legacy.getState().playing, false);

    // 2. اختيار الأغنية الثانية (index 1) قبل اكتمال Promise الأول
    // في المصدر الأصلي: const resume = playing (وهي false!) فلا يشغّل الأغنية الجديدة
    const selectResult = legacy.select(1);
    assert.equal(selectResult, undefined);
    assert.equal(audio.playCalls.length, 1, 'المصدر الأصلي فشل في استدعاء play() للأغنية الجديدة');
    assert.equal(audio.pauseCalls.length, 1);
    assert.deepEqual(legacy.getState(), { index: 1, playing: false });

    // 3. عندما ينجح Promise الطلب القديم (الخاص بالأغنية الأولى)، يغيّر playing إلى true كذبًا!
    await audio.playCalls[0].resolve();
    await p1;

    assert.deepEqual(
      legacy.getState(),
      { index: 1, playing: true },
      'الطلب القديم غيّر حالة المشغل إلى playing=true رغم أن الأغنية الثانية لم تُشغّل أبدًا'
    );
  });
});

describe('ثانيًا وثالثًا: اختبارات الوحدة المصلحة (Fixed Player Controller)', () => {
  test('1. الحالة الابتدائية دون تشغيل تلقائي', () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const state = player.getState();
    assert.equal(state.index, 0);
    assert.equal(state.playing, false);
    assert.equal(state.pending, false);
    assert.equal(state.desiredPlaying, false);
    assert.equal(state.status, 'paused');
    assert.equal(state.error, null);
    assert.equal(state.disposed, false);
    assert.equal(state.trackCount, 14);
    assert.equal(state.src, MOCK_14_TRACKS[0].src);

    assert.equal(audio.src, MOCK_14_TRACKS[0].src);
    assert.equal(audio.playCalls.length, 0);
    assert.equal(audio.pauseCalls.length, 0);
    assert.equal(audio.listenerCount('ended'), 1);
  });

  test('2. تشغيل ناجح ثم إيقاف', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const playPromise = player.play();
    assert.equal(audio.playCalls.length, 1);
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().pending, true);
    assert.equal(player.getState().desiredPlaying, true);
    assert.equal(player.getState().playing, false);

    await audio.playCalls[0].resolve();
    const resolvedValue = await playPromise;

    assert.equal(resolvedValue, true);
    assert.equal(player.getState().status, 'playing');
    assert.equal(player.getState().pending, false);
    assert.equal(player.getState().desiredPlaying, true);
    assert.equal(player.getState().playing, true);

    player.pause();
    assert.equal(audio.pauseCalls.length, 1);
    assert.equal(player.getState().status, 'paused');
    assert.equal(player.getState().pending, false);
    assert.equal(player.getState().desiredPlaying, false);
    assert.equal(player.getState().playing, false);
  });

  test('3. تشغيل معلق ثم إيقاف عبر toggle قبل اكتماله (دون استدعاء play إضافي)', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const p1 = player.play();
    assert.equal(audio.playCalls.length, 1);
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().desiredPlaying, true);

    // الضغط على toggle أثناء انتظار play() يعني الإيقاف
    const togglePromise = player.toggle();
    assert.equal(await togglePromise, false);

    assert.equal(audio.playCalls.length, 1, 'لا يجوز استدعاء play() مرة ثانية');
    assert.equal(audio.pauseCalls.length, 1, 'يجب استدعاء pause() فورًا');
    assert.equal(player.getState().status, 'paused');
    assert.equal(player.getState().pending, false);
    assert.equal(player.getState().desiredPlaying, false);
    assert.equal(player.getState().playing, false);

    // حتى بعد تسوية Promise الأول
    await audio.playCalls[0].resolve();
    assert.equal(await p1, false);
    assert.equal(player.getState().status, 'paused');
    assert.equal(player.getState().playing, false);
  });

  test('4. نجاح قديم يصل بعد الإيقاف الصريح لا يعيد المشغل إلى playing', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const playPromise = player.play();
    player.pause();

    assert.equal(player.getState().status, 'paused');
    assert.equal(player.getState().playing, false);

    // يصل نجاح الطلب القديم متأخرًا
    await audio.playCalls[0].resolve();
    const result = await playPromise;

    assert.equal(result, false);
    assert.equal(player.getState().status, 'paused');
    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().desiredPlaying, false);
    assert.equal(audio.playCalls.length, 1);
    assert.equal(audio.pauseCalls.length, 1);
  });

  test('5. رفض قديم يصل بعد بدء طلب أحدث لا يلوث حالة الطلب الأحدث', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    // الطلب الأول على الأغنية 0
    const p1 = player.play();
    assert.equal(audio.playCalls.length, 1);

    // المستخدم يختار الأغنية 1 قبل اكتمال الطلب الأول -> يبدأ الطلب الثاني
    const p2 = player.select(1);
    assert.equal(audio.playCalls.length, 2);
    assert.equal(player.getState().index, 1);
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().desiredPlaying, true);

    // الطلب الأول يُرفض متأخرًا (مثل AbortError عند تغيير المصدر)
    await audio.playCalls[0].reject(new Error('AbortError: interrupted by new load request'));
    assert.equal(await p1, false);

    // يجب أن يظل الطلب الثاني في حالة loading دون خطأ
    assert.equal(player.getState().index, 1);
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().desiredPlaying, true);
    assert.equal(player.getState().error, null);

    // الآن ينجح الطلب الثاني
    await audio.playCalls[1].resolve();
    assert.equal(await p2, true);

    assert.equal(player.getState().index, 1);
    assert.equal(player.getState().status, 'playing');
    assert.equal(player.getState().playing, true);
    assert.equal(player.getState().error, null);
  });

  test('6. تغيير الأغنية أثناء انتظار التشغيل ينقل قصد التشغيل للأغنية الجديدة ويتجاهل نجاح القديم', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const p1 = player.play();
    assert.equal(audio.playCalls.length, 1);
    assert.equal(audio.playCalls[0].src, MOCK_14_TRACKS[0].src);

    // اختيار الأغنية 4 أثناء انتظار تشغيل الأغنية 0
    const p2 = player.select(4);
    assert.equal(audio.playCalls.length, 2);
    assert.equal(audio.playCalls[1].src, MOCK_14_TRACKS[4].src);
    assert.equal(audio.pauseCalls.length, 1);
    assert.equal(player.getState().index, 4);
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().desiredPlaying, true);

    // نجاح الطلب الأول القديم لا يجعل الأغنية 4 تبدو وكأنها تعمل قبل اكتمال طلبها الخاص
    await audio.playCalls[0].resolve();
    assert.equal(await p1, false);
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().playing, false);

    // نجاح طلب الأغنية 4 يؤكد التشغيل
    await audio.playCalls[1].resolve();
    assert.equal(await p2, true);
    assert.equal(player.getState().index, 4);
    assert.equal(player.getState().status, 'playing');
    assert.equal(player.getState().playing, true);
  });

  test('7. تغيير الأغنية أثناء الإيقاف يبقي المشغل متوقفًا دون استدعاء play()', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const result = await player.select(6);
    assert.equal(result, false);
    assert.equal(audio.playCalls.length, 0);
    assert.equal(audio.pauseCalls.length, 1);
    assert.equal(audio.src, MOCK_14_TRACKS[6].src);

    const state = player.getState();
    assert.equal(state.index, 6);
    assert.equal(state.status, 'paused');
    assert.equal(state.playing, false);
    assert.equal(state.pending, false);
    assert.equal(state.desiredPlaying, false);
  });

  test('8. عدة ضغطات تشغيل وإيقاف متتالية (Rapid Toggle Sequence)', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    // ضغطة 1: تشغيل (play #1)
    const t1 = player.toggle();
    assert.equal(player.getState().desiredPlaying, true);
    assert.equal(audio.playCalls.length, 1);

    // ضغطة 2: إيقاف (pause #1)
    const t2 = player.toggle();
    assert.equal(player.getState().desiredPlaying, false);
    assert.equal(audio.pauseCalls.length, 1);

    // ضغطة 3: تشغيل (play #2)
    const t3 = player.toggle();
    assert.equal(player.getState().desiredPlaying, true);
    assert.equal(audio.playCalls.length, 2);

    // ضغطة 4: إيقاف (pause #2)
    const t4 = player.toggle();
    assert.equal(player.getState().desiredPlaying, false);
    assert.equal(audio.pauseCalls.length, 2);

    // ضغطة 5: تشغيل (play #3 - الأمر النهائي للمستخدم)
    const t5 = player.toggle();
    assert.equal(player.getState().desiredPlaying, true);
    assert.equal(player.getState().status, 'loading');
    assert.equal(audio.playCalls.length, 3);

    // تسوية الوعود القديمة بترتيب معكوس/مختلط
    await audio.playCalls[1].reject(new Error('Stale error #2'));
    await audio.playCalls[0].resolve();
    assert.equal(await t1, false);
    assert.equal(await t2, false);
    assert.equal(await t3, false);
    assert.equal(await t4, false);

    // لم يتأثر الطلب الثالث الأحدث
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().error, null);

    // الآن ينجح الطلب الثالث
    await audio.playCalls[2].resolve();
    assert.equal(await t5, true);
    assert.equal(player.getState().status, 'playing');
    assert.equal(player.getState().playing, true);
  });

  test('9. تبديلات سريعة بين أغنيات متعددة أثناء انتظار التشغيل', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const p0 = player.play(); // Track 0
    const p3 = player.select(3); // Track 3
    const p9 = player.select(9); // Track 9
    const p10 = player.next(); // Track 10
    const p9Again = player.previous(); // Track 9

    assert.equal(audio.playCalls.length, 5);
    assert.equal(player.getState().index, 9);
    assert.equal(player.getState().src, MOCK_14_TRACKS[9].src);
    assert.equal(player.getState().status, 'loading');

    // تسوية كل الطلبات السابقة (من 0 إلى 3) بنجاح أو رفض
    await audio.playCalls[0].resolve();
    await audio.playCalls[1].reject(new Error('aborted 3'));
    await audio.playCalls[2].resolve();
    await audio.playCalls[3].resolve();

    assert.equal(await p0, false);
    assert.equal(await p3, false);
    assert.equal(await p9, false);
    assert.equal(await p10, false);

    // لا يزال المشغل ينتظر نتيجة الطلب الخامس الأخير فقط
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().index, 9);

    await audio.playCalls[4].resolve();
    assert.equal(await p9Again, true);
    assert.equal(player.getState().status, 'playing');
    assert.equal(player.getState().playing, true);
    assert.equal(player.getState().index, 9);
  });

  test('10. رفض التشغيل يترك حالة خطأ واضحة دون إعادة محاولة تلقائية، ويسمح بإعادة محاولة صريحة ناجحة', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const firstAttempt = player.play();
    const rejectionReason = new Error('NotAllowedError: play() failed because the user did not interact');
    await audio.playCalls[0].reject(rejectionReason);

    assert.equal(await firstAttempt, false);
    assert.equal(audio.playCalls.length, 1, 'لا توجد إعادة محاولة تلقائية');

    const errorState = player.getState();
    assert.equal(errorState.status, 'error');
    assert.equal(errorState.playing, false);
    assert.equal(errorState.pending, false);
    assert.equal(errorState.desiredPlaying, false);
    assert.equal(errorState.error, rejectionReason);

    // إعادة محاولة صريحة بواسطة المستخدم عبر toggle() أو play()
    const retryAttempt = player.toggle();
    assert.equal(audio.playCalls.length, 2);
    assert.equal(player.getState().status, 'loading');
    assert.equal(player.getState().error, null);

    await audio.playCalls[1].resolve();
    assert.equal(await retryAttempt, true);

    const finalState = player.getState();
    assert.equal(finalState.status, 'playing');
    assert.equal(finalState.playing, true);
    assert.equal(finalState.error, null);
  });

  test('11. خطأ متزامن (Synchronous Throw) من audio.play() يُلتقط بأمان ويسمح بالمحاولة مجددًا', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const syncError = new Error('Synchronous DOMException in play()');
    audio.syncErrorOnNextPlay = syncError;

    const result = await player.play();
    assert.equal(result, false);
    assert.equal(audio.playCalls.length, 1);

    const stateAfterThrow = player.getState();
    assert.equal(stateAfterThrow.status, 'error');
    assert.equal(stateAfterThrow.playing, false);
    assert.equal(stateAfterThrow.pending, false);
    assert.equal(stateAfterThrow.desiredPlaying, false);
    assert.equal(stateAfterThrow.error, syncError);

    // المحاولة مجددًا بعد الخطأ المتزامن
    const retryPromise = player.play();
    await audio.playCalls[1].resolve();
    assert.equal(await retryPromise, true);
    assert.equal(player.getState().status, 'playing');
    assert.equal(player.getState().playing, true);
    assert.equal(player.getState().error, null);
  });

  test('12. الانتقال عبر الأغنيات الأربع عشرة عند انتهاء كل أغنية ثم العودة من 14 إلى الأولى', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    // بدء تشغيل الأغنية الأولى (index 0)
    const initialPlay = player.play();
    await audio.playCalls[0].resolve();
    await initialPlay;
    assert.equal(player.getState().index, 0);
    assert.equal(player.getState().playing, true);

    // إطلاق ended 14 مرة للانتقال من 0 -> 1 -> ... -> 13 -> 0
    for (let step = 1; step <= 14; step += 1) {
      const expectedIndex = step % 14;
      audio.emitEnded();

      // فور انتهاء الأغنية، ينتقل الفهرس ويبدأ تحميل الأغنية التالية
      assert.equal(player.getState().index, expectedIndex);
      assert.equal(player.getState().status, 'loading');
      assert.equal(player.getState().desiredPlaying, true);
      assert.equal(audio.src, MOCK_14_TRACKS[expectedIndex].src);
      assert.equal(audio.playCalls.length, step + 1);

      // تسوية طلب التشغيل للأغنية الجديدة
      await audio.playCalls[step].resolve();
      assert.equal(player.getState().index, expectedIndex);
      assert.equal(player.getState().status, 'playing');
      assert.equal(player.getState().playing, true);
    }

    // بعد 14 انتقالًا، نعود إلى الأغنية الأولى (index 0)
    assert.equal(player.getState().index, 0);
    assert.equal(audio.src, MOCK_14_TRACKS[0].src);
  });

  test('13. حدث ended بعد طلب المستخدم الإيقاف (أو أثناء الانتظار) لا يعيد التشغيل ولا يغير الأغنية', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const playPromise = player.play();
    await audio.playCalls[0].resolve();
    await playPromise;
    assert.equal(player.getState().playing, true);

    // المستخدم يطلب الإيقاف
    player.pause();
    assert.equal(player.getState().status, 'paused');
    assert.equal(audio.playCalls.length, 1);

    // وصول حدث ended متأخر بعد الإيقاف
    audio.emitEnded();

    assert.equal(player.getState().index, 0);
    assert.equal(player.getState().status, 'paused');
    assert.equal(player.getState().playing, false);
    assert.equal(audio.playCalls.length, 1, 'لم يتم استدعاء play() بعد ended المتأخر');
  });

  test('14. dispose() أثناء انتظار التشغيل يوقف الصوت ويفك المستمعين ويمنع النتائج المتأخرة من تغيير الحالة', async () => {
    const audio = new FakeAudio();
    const player = createPlayer(audio, MOCK_14_TRACKS);

    const pendingPlay = player.play();
    assert.equal(player.getState().status, 'loading');
    assert.equal(audio.listenerCount('ended'), 1);

    player.dispose();

    assert.equal(audio.listenerCount('ended'), 0, 'تم فك مستمع ended');
    assert.equal(audio.pauseCalls.length, 1, 'تم إيقاف الصوت عند dispose');
    assert.equal(player.getState().status, 'disposed');
    assert.equal(player.getState().disposed, true);
    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().pending, false);
    assert.equal(player.getState().desiredPlaying, false);

    // تسوية Promise المعلق بعد dispose()
    await audio.playCalls[0].resolve();
    assert.equal(await pendingPlay, false);

    // محاولة استدعاء أوامر أو إطلاق ended بعد dispose()
    audio.emitEnded();
    assert.equal(await player.play(), false);
    assert.equal(await player.toggle(), false);
    assert.equal(await player.select(5), false);
    assert.equal(await player.next(), false);

    assert.equal(audio.playCalls.length, 1, 'لا تُنفذ أي استدعاءات play بعد dispose');
    assert.equal(player.getState().index, 0);
    assert.equal(player.getState().status, 'disposed');
    assert.equal(player.getState().playing, false);
  });

  test('15. القائمة الفارغة والفهرس غير الصحيح يرميان أخطاء واضحة دون إفساد حالة المشغل', async () => {
    const audio = new FakeAudio();

    // قائمة فارغة
    assert.throws(
      () => createPlayer(audio, []),
      {
        name: 'RangeError',
        message: /Track list must not be empty/
      }
    );

    // قائمة ليست مصفوفة أو عنصر بدون src
    assert.throws(() => createPlayer(audio, null), { name: 'TypeError' });
    assert.throws(() => createPlayer(audio, [{ src: '' }]), { name: 'TypeError' });

    // إنشاء مشغل سليم وتشغيله ثم اختبار الفهارس غير الصحيحة
    const player = createPlayer(audio, MOCK_14_TRACKS);
    const p = player.play();
    await audio.playCalls[0].resolve();
    await p;

    assert.equal(player.getState().playing, true);
    assert.equal(player.getState().index, 0);

    for (const invalidIndex of [-1, 14, 99, 1.5, NaN, '2', null, undefined]) {
      assert.throws(
        () => player.select(invalidIndex),
        { name: 'RangeError' },
        `الفهرس غير الصحيح ${String(invalidIndex)} يجب أن يرمي RangeError`
      );
    }

    // التأكد من بقاء المشغل في حالته الصحيحة دون توقف أو تغيير مصدر الصوت
    assert.equal(player.getState().index, 0);
    assert.equal(player.getState().status, 'playing');
    assert.equal(player.getState().playing, true);
    assert.equal(audio.src, MOCK_14_TRACKS[0].src);
    assert.equal(audio.pauseCalls.length, 0);
  });
});
