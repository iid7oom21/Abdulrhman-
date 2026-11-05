import { test, expect, boot, expectNoOverflow } from './helpers.mjs';

// These checks use the supplied opening film, including its actual ended event.
// The optional executable path permits the workspace's system Chromium without
// changing the shared test configuration or other browsers' normal defaults.
test.use({
  contextOptions: { reducedMotion: 'no-preference' },
  ...(process.env.RAVEN_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.RAVEN_CHROMIUM_PATH } } : {}),
});

const opening = page => page.locator('.opening-dialog');
const film = page => page.locator('#raven-opening-video');
const replay = page => page.getByRole('button', { name: 'إعادة الافتتاحية', exact: true });
const skip = page => opening(page).getByRole('button', { name: 'تخطي الافتتاحية', exact: true });
const soundtrack = page => page.locator('#preview-soundtrack');
const isPlaying = media => media.evaluate(element => !element.paused && element.currentTime > 0);

function fixtureSong() {
  const rate = 8000;
  const body = Buffer.alloc(44 + rate * 60 * 2);
  body.write('RIFF', 0); body.writeUInt32LE(body.length - 8, 4); body.write('WAVEfmt ', 8);
  body.writeUInt32LE(16, 16); body.writeUInt16LE(1, 20); body.writeUInt16LE(1, 22);
  body.writeUInt32LE(rate, 24); body.writeUInt32LE(rate * 2, 28); body.writeUInt16LE(2, 32); body.writeUInt16LE(16, 34);
  body.write('data', 36); body.writeUInt32LE(body.length - 44, 40);
  return body;
}

test('home opens the supplied portrait film muted and a real ending reveals the page', async ({ page }) => {
  await boot(page);
  await expect(opening(page)).toBeVisible();
  await expect.poll(() => isPlaying(film(page))).toBe(true);
  expect(await film(page).evaluate(video => video.muted && video.playsInline)).toBe(true);
  expect(await film(page).evaluate(video => [video.videoWidth, video.videoHeight])).toEqual([1080, 1920]);
  await expectNoOverflow(page);

  await film(page).evaluate(video => {
    window.__openingNativeEnded = false;
    window.__openingVideo = video;
    // Observe before the application releases and unloads the media element.
    video.addEventListener('ended', () => { window.__openingNativeEnded = true; }, { once: true, capture: true });
    // Range-capable hosts permit a quick real end. A plain static test server
    // can expose no seekable range, in which case let the 12-second film finish.
    if (video.seekable.length && video.seekable.end(video.seekable.length - 1) >= video.duration - .3) {
      video.currentTime = video.duration - .3;
    }
  });
  await expect.poll(() => page.evaluate(() => window.__openingNativeEnded), { timeout: 18000 }).toBe(true);
  await expect(opening(page)).toBeHidden();
  await expect(page.locator('.home-page')).toBeVisible();
  expect(await page.evaluate(() => window.__openingVideo.paused)).toBe(true);
  await expect(page.locator('#route-outlet h1')).toBeFocused();
});

test('skip, explicit replay and Escape preserve the film save and restore focus', async ({ page }) => {
  const savedFilm = { time: 42, watched: false };
  await page.addInitScript(value => {
    localStorage.setItem('raven-preview:v1:episode:2', JSON.stringify(value));
    localStorage.setItem('raven-preview:v1:musicEnabled', 'false');
  }, savedFilm);
  await boot(page);
  await expect(opening(page)).toBeVisible();
  await skip(page).click();
  await expect(opening(page)).toBeHidden();
  await expect(page.locator('#route-outlet h1')).toBeFocused();

  await replay(page).click();
  await expect(opening(page)).toBeVisible();
  await expect.poll(() => isPlaying(film(page))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(opening(page)).toBeHidden();
  await expect(replay(page)).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:episode:2')))).toEqual(savedFilm);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
  await expect(soundtrack(page)).toHaveCount(1);
});

// Handoff v2: the direct link is now a film page; the investigation route was removed with the story.
test('a direct film link and an internal return home are never interrupted', async ({ page }) => {
  await boot(page, 'raven-17/part-1/');
  await expect(page.locator('#route-outlet h1')).toBeVisible();
  await expect(opening(page)).toBeHidden();
  await page.evaluate(() => { window.__openingNavigationMarker = true; });
  await page.locator('#site-header .brand').click();
  await expect(page.locator('.home-page')).toBeVisible();
  await expect(opening(page)).toBeHidden();
  expect(await page.evaluate(() => window.__openingNavigationMarker)).toBe(true);
  await replay(page).click();
  await expect(opening(page)).toBeVisible();
  await skip(page).click();
});

for (const preference of ['reduced motion', 'quiet view', 'Save-Data']) {
  test(`${preference} avoids an automatic film download but permits explicit replay`, async ({ page }) => {
    if (preference === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (preference === 'quiet view') await page.addInitScript(() => localStorage.setItem('raven-preview:v1:quiet', 'true'));
    if (preference === 'Save-Data') await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
    const requests = [];
    page.on('request', request => { if (/raven-intro\.mp4/.test(request.url())) requests.push(request.url()); });

    await boot(page);
    await expect(replay(page)).toBeVisible();
    await expect(opening(page)).toBeHidden();
    expect(requests).toHaveLength(0);
    await replay(page).click();
    await expect(opening(page)).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await expect.poll(() => isPlaying(film(page))).toBe(true);
    await skip(page).click();
    await expect(replay(page)).toBeFocused();
  });
}

test('playback controls require explicit sound and pause/resume the opening', async ({ page }) => {
  await boot(page);
  await expect.poll(() => isPlaying(film(page))).toBe(true);
  await opening(page).getByRole('button', { name: 'إيقاف مؤقت', exact: true }).click();
  expect(await film(page).evaluate(video => video.paused)).toBe(true);
  await opening(page).getByRole('button', { name: 'تشغيل الصوت', exact: true }).click();
  expect(await film(page).evaluate(video => video.muted)).toBe(false);
  await opening(page).getByRole('button', { name: 'متابعة الافتتاحية', exact: true }).click();
  await expect.poll(() => isPlaying(film(page))).toBe(true);
  await skip(page).click();
});

test('a missing opening film still leaves a working path into the page', async ({ page }) => {
  await page.route('**/raven-intro.mp4*', request => request.fulfill({ status: 404, contentType: 'text/plain', body: 'Missing fixture' }));
  await boot(page);
  await expect(opening(page)).toBeVisible();
  await expect.poll(() => film(page).evaluate(video => Boolean(video.error))).toBe(true);
  await expect(skip(page)).toBeEnabled();
  await skip(page).click();
  await expect(page.locator('.home-page')).toBeVisible();
  await expect(opening(page)).toBeHidden();
  await page.locator('#site-header a[href*="raven-17/"]').click();
  await expect(page.locator('.film-grid')).toBeVisible();
});

test('a browser autoplay refusal offers a working explicit play button and skip', async ({ page }) => {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    let blocked = false;
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.id === 'raven-opening-video' && !blocked) {
        blocked = true;
        return Promise.reject(new DOMException('Autoplay denied by test policy', 'NotAllowedError'));
      }
      return originalPlay.apply(this, args);
    };
  });
  await boot(page);
  await expect(opening(page)).toBeVisible();
  const start = opening(page).getByRole('button', { name: 'تشغيل الافتتاحية', exact: true });
  await expect(start).toBeVisible();
  expect(await film(page).evaluate(video => video.paused)).toBe(true);
  await expect(skip(page)).toBeEnabled();
  await start.click();
  await expect.poll(() => isPlaying(film(page))).toBe(true);
  await expect(start).toBeHidden();
  await skip(page).click();
  await expect(opening(page)).toBeHidden();
});

test('opening holds the existing soundtrack, releases it, and respects a manual music pause', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*raven-baqi-athar*.mp3*', request => request.fulfill({ contentType: 'audio/wav', body: fixtureSong() }));
  await boot(page);
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => isPlaying(soundtrack(page))).toBe(true);
  await soundtrack(page).evaluate(audio => { window.__openingAudioOwner = audio; });
  await replay(page).click();
  await expect(opening(page)).toBeVisible();
  await expect.poll(() => soundtrack(page).evaluate(audio => audio.paused)).toBe(true);
  await skip(page).click();
  await expect.poll(() => isPlaying(soundtrack(page))).toBe(true);
  expect(await page.evaluate(() => document.querySelector('#preview-soundtrack') === window.__openingAudioOwner)).toBe(true);

  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => soundtrack(page).evaluate(audio => audio.paused)).toBe(true);
  await replay(page).click();
  await skip(page).click();
  expect(await soundtrack(page).evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
  await expect(soundtrack(page)).toHaveCount(1);
});
