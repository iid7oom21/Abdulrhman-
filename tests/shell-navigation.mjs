// Run against a served repository with Playwright installed, like tests/legacy-episodes.mjs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
const archive = new URL(process.env.RAVEN_SHELL_URL || 'http://127.0.0.1:3000/raven/');
const game = new URL('after-show/', archive);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.route('**/*', route => new URL(route.request().url()).origin === archive.origin
    ? route.continue() : route.abort());
  const frame = page.frameLocator('#site-content');
  const frameURL = () => frame.locator('html').evaluate(el => el.ownerDocument.URL);
  const recovery = page.locator('#site-recovery');
  const retry = page.locator('#site-retry');
  let gameRequests = 0;
  await page.route(url => url.pathname === game.pathname + 'index.html', route => ++gameRequests === 1
    ? route.fulfill({ status: 503, contentType: 'text/html', body: '<title>Unavailable</title>' }) : route.continue());

  await page.goto(new URL('?lang=en#top', archive).href, { waitUntil: 'domcontentloaded' });
  await expect(recovery).toBeHidden();
  // Native iframe history can refetch this URL on Forward. It must serve content, not another shell.
  assert.equal(new URL(await frameURL()).pathname, archive.pathname + 'content.html');
  const soundtrack = await page.locator('#site-soundtrack').elementHandle();
  await frame.locator('#rvnAfterShow').click();
  await expect(recovery).toHaveClass(/is-loading/);
  await expect(page.locator('#site-content')).toHaveAttribute('aria-busy', 'true');
  await expect(retry).toBeVisible({ timeout: 16_000 });
  await expect(page.locator('#site-load-message')).toHaveText('The page could not finish loading.');
  const direct = new URL(await page.locator('#site-direct').getAttribute('href'));
  assert.equal(direct.pathname, game.pathname + 'index.html');
  assert.equal(direct.searchParams.get('lang'), 'en');
  const historyLength = await page.evaluate(() => history.length);
  await retry.click();
  await expect(frame.locator('#start')).toBeEnabled();
  await expect(recovery).toBeHidden();
  await expect(frame.locator('main')).toBeFocused();
  assert.equal(await page.evaluate(() => history.length), historyLength);

  const gameURL = new URL('?lang=en', game).href;
  await expect(page).toHaveURL(gameURL);
  await frame.locator('#archive').click();
  await expect(frame.locator('#rvnAfterShow')).toBeVisible();
  await expect(recovery).toBeHidden();
  await expect(frame.locator('#top')).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(gameURL);
  await expect(frame.locator('#archive')).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(new URL('?lang=en#top', archive).href);
  await expect(frame.locator('#rvnAfterShow')).toBeVisible();
  await expect(recovery).toBeHidden();
  assert.equal(new URL(await frameURL()).pathname, archive.pathname + 'content.html');
  assert.equal(await frame.locator('#site-content').count(), 0);
  assert.ok(await soundtrack.evaluate(el => el === document.querySelector('#site-soundtrack')));
  console.log('PASS: archive/game loading, timeout and retry, destination focus, Back/Forward, no nested shell, same soundtrack.');
} finally { await browser.close(); }
