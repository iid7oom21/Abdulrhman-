import { test, expect, boot } from './helpers.mjs';

test('the page stays below 1.5 MB and the supplied opening has a separate 10 MB budget', async ({ browser, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Transfer accounting uses Chromium CDP.');
  const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const received = [];
  const urls = new Map();
  cdp.on('Network.requestWillBeSent', event => urls.set(event.requestId, event.request.url));
  cdp.on('Network.loadingFinished', event => received.push({ url: urls.get(event.requestId), bytes: event.encodedDataLength }));
  try {
    await boot(page);
    await page.waitForLoadState('networkidle');
    const opening = received.filter(entry => /raven-intro\.mp4/.test(entry.url || ''));
    const openingBytes = opening.reduce((sum, entry) => sum + entry.bytes, 0);
    const pageBytes = received.filter(entry => !/raven-intro\.mp4/.test(entry.url || '')).reduce((sum, entry) => sum + entry.bytes, 0);
    await info.attach('initial-transfer.json', { body: JSON.stringify({ pageBytes, openingBytes, received }, null, 2), contentType: 'application/json' });
    expect(pageBytes).toBeGreaterThan(0);
    expect(pageBytes).toBeLessThan(1500000);
    expect(openingBytes).toBeGreaterThan(0);
    expect(openingBytes).toBeLessThan(10000000);
    expect(received.some(entry => /raven-baqi-athar|episode-[123]\.mp4/.test(entry.url || ''))).toBe(false);
  } finally { await context.close(); }
});

test('Save-Data keeps the cinematic hero as a poster', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await boot(page);
  await page.waitForLoadState('networkidle');
  expect(requests.filter(url => /hero-loop\.mp4|raven-intro\.mp4/.test(url))).toEqual([]);
  expect(await page.locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
});
