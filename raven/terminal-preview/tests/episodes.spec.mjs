import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, boot, route, expectNoOverflow } from './helpers.mjs';

const keys = ['raven-preview:v1:episode:1', 'raven-preview:v1:episode:2', 'raven-preview:v1:episode:3'];
const retired = { time: 55, watched: true };
const stored = page => page.evaluate(names => names.map(key => JSON.parse(localStorage.getItem(key))), keys);
async function seed(context, progress) {
  await context.addInitScript(({ keys, progress }) => {
    if (localStorage.getItem('test:episode-renumbering')) return;
    progress.forEach((value, index) => { if (value) localStorage.setItem(keys[index], JSON.stringify(value)); });
    localStorage.setItem('raven-preview:v1:musicEnabled', 'false');
    localStorage.setItem('test:episode-renumbering', '1');
  }, { keys, progress });
}

test('the two published episodes keep their real posters and durations with Arabic and English numbering', async ({ page, context }) => {
  await seed(context, [retired]);
  await page.setViewportSize({ width: 320, height: 844 });
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  for (const lang of ['ar', 'en']) {
    for (const path of ['', 'raven-17/']) {
      await boot(page, `${path}?lang=${lang}`);
      const cards = page.locator('[data-episode-card]');
      await expect(cards).toHaveCount(2);
      await expect(cards.locator('h3')).toHaveText(lang === 'ar' ? ['الجزء الأول', 'الجزء الثاني'] : ['Part One', 'Part Two']);
      for (const [display, original, duration] of [[1, 2, '1:55'], [2, 3, '3:58']]) {
        const card = page.locator(`[data-episode-card="${display}"]`);
        await expect(card.locator('img')).toHaveAttribute('src', new RegExp(`/episode-${original}\\.jpg(?:\\?|$)`));
        await expect(card.locator('.film-meta')).toContainText(duration);
        await expect(card.locator('a').first()).toHaveAttribute('href', new RegExp(`/part-${display}/(?:\\?lang=en)?$`));
        await expect(card.locator('.watched-tag')).toHaveCount(0);
      }
      await expect(page.locator('.films-section')).not.toContainText(/ثلاث|trilogy|Three chapters/i);
      await expectNoOverflow(page);
    }
  }
  expect((await stored(page))[0]).toEqual(retired);
  expect(requests.some(url => /episode-1\.(?:mp4|jpg)/.test(url))).toBe(false);
});

test('resume and watched updates stay with each original film after renumbering and reload', async ({ page, context }) => {
  await seed(context, [retired, { time: 3, watched: false }, { time: 4, watched: false }]);
  // Decode an actual short film fixture; these tests verify the requested source
  // and saved-position ownership, not the remote film's artistic content.
  const fixture = fs.readFileSync(fileURLToPath(new URL('../assets/hero-loop.mp4', import.meta.url)));
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  const deliverFilm = request => {
    const range = /bytes=(\d+)-(\d*)/.exec(request.request().headers().range || '');
    if (range) {
      const start = Number(range[1]), end = range[2] ? Number(range[2]) : fixture.length - 1;
      return request.fulfill({ status: 206, contentType: 'video/mp4', headers: {
        'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${fixture.length}`,
      }, body: fixture.subarray(start, end + 1) });
    }
    return request.fulfill({ contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes' }, body: fixture });
  };
  await page.route('**/episode-2.mp4*', deliverFilm);
  await page.route('**/episode-3.mp4*', deliverFilm);
  await boot(page, 'raven-17/');
  await expect(page.locator('[data-episode-card="1"] .watched-tag')).toContainText('0:03');
  await expect(page.locator('[data-episode-card="2"] .watched-tag')).toContainText('0:04');
  await page.locator('[data-episode-card="1"] a').first().click();
  const first = page.locator('[data-film-video="1"]');
  await expect(page.locator('.direct-video-link')).toHaveAttribute('href', /\/episode-2\.mp4$/);
  await first.evaluate(video => video.addEventListener('playing', () => { video.dataset.initialPlayback = String(video.currentTime); }, { once: true }));
  await page.locator('.theater-controls [data-media-start]').first().click();
  await expect(first).toHaveAttribute('src', /\/episode-2\.mp4$/);
  await expect.poll(() => first.evaluate(video => Math.floor(Number(video.dataset.initialPlayback)))).toBe(3);
  await first.evaluate(video => { video.pause(); video.currentTime = 4.2; });
  // The real seek/timeupdate event and navigation cleanup both persist to film 2.
  await expect.poll(async () => (await stored(page))[1].time).toBe(4);
  await page.locator('.theater-controls button[aria-pressed]').click();
  await expect.poll(async () => (await stored(page))[1].watched).toBe(true);
  await page.locator('.part-navigation a[href*="/part-2/"]').click();
  const second = page.locator('[data-film-video="2"]');
  await expect(second).toBeVisible();
  const beforeSecond = await stored(page);
  expect(beforeSecond[0]).toEqual(retired);
  expect(beforeSecond[1]).toEqual({ time: 4, watched: true });
  expect(beforeSecond[2]).toEqual({ time: 4, watched: false });
  await expect(page.locator('.direct-video-link')).toHaveAttribute('href', /\/episode-3\.mp4$/);
  await second.evaluate(video => video.addEventListener('playing', () => { video.dataset.initialPlayback = String(video.currentTime); }, { once: true }));
  await page.locator('.theater-controls [data-media-start]').first().click();
  await expect(second).toHaveAttribute('src', /\/episode-3\.mp4$/);
  await expect.poll(() => second.evaluate(video => Math.floor(Number(video.dataset.initialPlayback)))).toBe(4);
  await second.evaluate(video => video.pause());
  await page.locator('.theater-controls button[aria-pressed]').click();
  await expect.poll(async () => (await stored(page))[2].watched).toBe(true);
  await page.reload();
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17 — الجزء الثاني');
  await expect(page.locator('.theater-controls button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
  const after = await stored(page);
  expect(after[0]).toEqual(retired);
  expect(after[1]).toEqual(beforeSecond[1]);
  expect(after[2].time).toBeGreaterThanOrEqual(4);
  expect(after[2].watched).toBe(true);
  expect(requests.some(url => /episode-1\.mp4/.test(url))).toBe(false);
});

test('the former third-part link resolves to the second without losing query, history or the audio owner', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page, 'raven-17/part-3/?lang=en&from=legacy#film');
  await expect(page).toHaveURL(route('raven-17/part-2/?lang=en&from=legacy#film'));
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17 — Part Two');
  await expect(page.locator('.direct-video-link')).toHaveAttribute('href', /\/episode-3\.mp4$/);
  await expect(page.locator('.part-navigation a')).toHaveCount(2);
  await page.evaluate(() => { window.__episodeAudio = document.querySelector('#preview-soundtrack'); });
  await page.locator('#site-header .primary-nav a[href*="/raven-17/"]').click();
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
  const filmsURL = page.url();
  await page.evaluate(href => {
    const legacy = document.createElement('a'); legacy.href = href; legacy.textContent = 'Old saved episode link';
    legacy.id = 'legacy-episode-link'; document.querySelector('#route-outlet').append(legacy);
  }, route('raven-17/part-3/?lang=en&from=archive#film'));
  await page.locator('#legacy-episode-link').click();
  await expect(page).toHaveURL(route('raven-17/part-2/?lang=en&from=archive#film'));
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17 — Part Two');
  expect(await page.evaluate(() => window.__episodeAudio === document.querySelector('#preview-soundtrack'))).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(filmsURL);
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
  expect(await page.evaluate(() => window.__episodeAudio === document.querySelector('#preview-soundtrack'))).toBe(true);
  expect(errors).toEqual([]);
});
