import { test, expect, PREVIEW, route, boot, expectNoOverflow } from './helpers.mjs';

// Handoff v2: 'case-017/' removed with the story; it is now a redirect to the preview home.
const paths = ['', 'raven-17/', 'raven-17/part-1/', 'raven-17/part-2/', 'raven-17/part-3/', 'zarqa/'];

test('every direct route has a static entry, noindex, and a mounted accessible page', async ({ page, request }) => {
  for (const path of paths) {
    const response = await request.get(route(path));
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toMatch(/name=["']robots["'][^>]+noindex/i);
    await boot(page, path);
    await expect(page.locator('#route-outlet h1')).toBeVisible();
    expect(await page.locator('iframe').count()).toBe(0);
    await expectNoOverflow(page);
  }
});

for (const width of [320, 390, 430, 1440]) {
  // Handoff v2: the investigation half of this check was removed with the story; the home half is unchanged.
  test(`home fits at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    await boot(page);
    await expectNoOverflow(page);
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true });
    const visibleSmallControls = await page.locator('button').evaluateAll(buttons => buttons.filter(button => {
      const r = button.getBoundingClientRect();
      return r.width && r.height && getComputedStyle(button).visibility !== 'hidden' && (r.height < 47.5 || r.width < 47.5);
    }).map(button => ({ text: button.textContent.trim(), width: button.offsetWidth, height: button.offsetHeight })));
    expect(visibleSmallControls).toEqual([]);
  });
}

test('cold load fetches no song or episode and the reduced motion hero remains a poster', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await boot(page);
  await page.waitForLoadState('networkidle');
  expect(requests.filter(url => /raven-baqi-athar.*\.mp3|episode-[123]\.mp4/i.test(url))).toEqual([]);
  const soundtrack = page.locator('#preview-soundtrack');
  expect(await soundtrack.evaluate(element => element.currentSrc || element.getAttribute('src') || '')).toBe('');
  expect(await soundtrack.evaluate(element => element.paused)).toBe(true);
  expect(await page.locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
});

// Handoff v2: the five tests below used the removed investigation route. They now exercise the
// remaining routes (films, episode, Zarqa, home) and keep their original intent.
test('internal navigation and Back keep the exact same audio node', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await page.evaluate(() => { window.__previewAudio = document.querySelector('#preview-soundtrack'); });
  await page.locator('#site-header a[href$="/raven-17/"]').click();
  await expect(page).toHaveURL(route('raven-17/'));
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17');
  expect(await page.evaluate(() => window.__previewAudio === document.querySelector('#preview-soundtrack'))).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(PREVIEW);
  await expect(page.locator('#route-outlet h1')).toHaveText(/كل حكاية\s*تترك أثرًا\./);
  await expect(page.locator('.home-page')).toBeVisible();
  expect(await page.evaluate(() => window.__previewAudio === document.querySelector('#preview-soundtrack'))).toBe(true);
  expect(errors).toEqual([]);
});

test('films to episode to Zarqa to home mounts each destination without route cleanup errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page, 'raven-17/');
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17');
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
  await page.locator('[data-episode-card="1"] a').first().click();
  await expect(page).toHaveURL(route('raven-17/part-1/'));
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17 — الجزء الأول');
  await expect(page.locator('[data-film-video="1"]')).toBeVisible();
  await page.locator('#site-header a[href$="/zarqa/"]').click();
  await expect(page).toHaveURL(route('zarqa/'));
  await expect(page.locator('#route-outlet h1')).toBeVisible();
  await expect(page.locator('[data-film-video="1"]')).toHaveCount(0);
  await page.locator('#site-header .brand').click();
  await expect(page).toHaveURL(PREVIEW);
  await expect(page.locator('#route-outlet h1')).toHaveText(/كل حكاية\s*تترك أثرًا\./);
  await expect(page.locator('.home-hero')).toBeVisible();
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a failed soundtrack does not prevent opening the films', async ({ page }) => {
  await page.route('**/*raven-baqi-athar*.mp3*', intercepted => intercepted.abort());
  await boot(page);
  await page.locator('#site-header a[href$="/raven-17/"]').click();
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17');
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
});

test('all preview storage remains isolated from legacy progress', async ({ context, page }) => {
  const legacy = JSON.stringify({ viewedIds: ['E02'], solvedIds: ['Q01'], activeIndex: 1 });
  await context.addInitScript(value => {
    if (!localStorage.getItem('test:legacy-seeded')) {
      localStorage.setItem('raven-case:fourth-signature-reconstruction', value);
      localStorage.setItem('raven17_episode_1_progress', '42');
      localStorage.setItem('raven_language', 'ar');
      localStorage.setItem('test:legacy-seeded', '1');
    }
  }, legacy);
  await boot(page);
  await boot(page, 'raven-17/part-1/');
  await expect(page.locator('#route-outlet h1')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('raven-case:fourth-signature-reconstruction'))).toBe(legacy);
  expect(await page.evaluate(() => localStorage.getItem('raven17_episode_1_progress'))).toBe('42');
});

test('denied persistent storage leaves the current session usable', async ({ context, page }) => {
  await context.addInitScript(() => {
    Storage.prototype.setItem = function () { throw new DOMException('Storage disabled', 'SecurityError'); };
    Storage.prototype.getItem = function () { throw new DOMException('Storage disabled', 'SecurityError'); };
  });
  await boot(page, 'raven-17/');
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17');
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
});
