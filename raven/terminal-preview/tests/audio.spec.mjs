import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, boot, route } from './helpers.mjs';

// Deterministic, real media decoding: synthetic PCM fixtures exercise playback
// policy and continuity. They do not assert the remote film's artistic content.
function silentWav(seconds = 30) {
  const rate = 8000;
  const body = Buffer.alloc(44 + rate * seconds * 2);
  body.write('RIFF', 0); body.writeUInt32LE(body.length - 8, 4); body.write('WAVEfmt ', 8);
  body.writeUInt32LE(16, 16); body.writeUInt16LE(1, 20); body.writeUInt16LE(1, 22);
  body.writeUInt32LE(rate, 24); body.writeUInt32LE(rate * 2, 28); body.writeUInt16LE(2, 32); body.writeUInt16LE(16, 34);
  body.write('data', 36); body.writeUInt32LE(body.length - 44, 40);
  return body;
}
async function fixtureSong(page) {
  await page.route('**/*raven-baqi-athar*.mp3*', request => request.fulfill({ contentType: 'audio/wav', body: silentWav() }));
}
const playing = page => page.locator('#preview-soundtrack').evaluate(audio => !audio.paused && audio.currentTime > 0);

async function audioOwner(page) {
  await fixtureSong(page);
  await page.route('**/__audio-owner-harness__', request => request.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${route('modules/audio.css')}"></head><body><div id="dock"></div></body></html>` }));
  await page.goto(route('__audio-owner-harness__'));
  await page.evaluate(async ({ audioURL, coreURL }) => {
    const { createAudio } = await import(audioURL);
    const { createStore } = await import(coreURL);
    const store = createStore();
    store.set('musicVolume', .8);
    const owner = createAudio(document.querySelector('#dock'), { store, t: ar => ar });
    const element = owner.element;
    let loads = 0;
    element.addEventListener('loadstart', () => { loads++; });
    window.__audioOwner = { owner, store, element, loads: () => loads };
  }, { audioURL: route('modules/audio.js'), coreURL: route('modules/core.js') });
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => playing(page)).toBe(true);
  await page.evaluate(() => {
    window.__audioOwner.source = window.__audioOwner.element.src;
    window.__audioOwner.position = window.__audioOwner.element.currentTime;
  });
}

test('music starts on interaction, keeps its position across routes, and remembers explicit pause', async ({ page }) => {
  await fixtureSong(page);
  await boot(page);
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => playing(page)).toBe(true);
  await page.evaluate(() => { window.__persistentAudio = document.querySelector('#preview-soundtrack'); window.__songPosition = window.__persistentAudio.currentTime; });
  // Handoff v2: the route change now goes to the films page instead of the removed investigation.
  await page.locator('#site-header a[href*="/raven-17/"]').first().click();
  await expect.poll(() => playing(page)).toBe(true);
  expect(await page.evaluate(() => window.__persistentAudio === document.querySelector('#preview-soundtrack') && window.__persistentAudio.currentTime >= window.__songPosition)).toBe(true);
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => page.locator('#preview-soundtrack').evaluate(audio => audio.paused)).toBe(true);
  await page.reload();
  await expect(page.locator('#route-outlet h1')).toBeVisible();
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
});

test('a film gets first-interaction audio priority, resumes music on pause, and respects manual music off', async ({ page }) => {
  await fixtureSong(page);
  const videoFile = fileURLToPath(new URL('../assets/hero-loop.mp4', import.meta.url));
  await page.route('**/episode-2.mp4*', request => request.fulfill({ contentType: 'video/mp4', body: fs.readFileSync(videoFile) }));
  await boot(page, 'raven-17/part-1/');
  const soundtrack = page.locator('#preview-soundtrack');
  const film = page.locator('[data-film-video="1"]');
  const button = page.locator('.theater-controls [data-media-start]').first();
  await button.click();
  await expect.poll(() => film.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  expect(await soundtrack.evaluate(audio => audio.hasAttribute('src'))).toBe(false);
  expect(await soundtrack.evaluate(audio => audio.paused)).toBe(true);
  await button.click();
  await expect.poll(() => playing(page)).toBe(true);
  await button.click();
  await expect.poll(() => film.evaluate(video => !video.paused)).toBe(true);
  await expect.poll(() => soundtrack.evaluate(audio => audio.paused)).toBe(true);
  await page.locator('[data-audio-toggle]').click();
  await button.click();
  expect(await soundtrack.evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
});

test('volume and ambience are explicit persistent choices with accessible settings dismissal', async ({ page }) => {
  await fixtureSong(page);
  await boot(page);
  await page.locator('.sound-settings-button').click();
  await expect(page.locator('#preview-music-volume')).toBeFocused();
  await page.locator('#preview-music-volume').fill('30');
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.volume)).toBeCloseTo(.3);
  await page.locator('[data-ambient-toggle]').click();
  await expect(page.locator('[data-ambient-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#preview-audio-settings')).toBeHidden();
  await expect(page.locator('.sound-settings-button')).toBeFocused();
  await page.reload();
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.volume)).toBeCloseTo(.3);
  await page.locator('.sound-settings-button').click();
  await expect(page.locator('[data-ambient-toggle]')).toHaveAttribute('aria-pressed', 'true');
});

test('duck tokens use the strongest attenuation and restore the newly chosen volume on the same soundtrack', async ({ page }) => {
  await audioOwner(page);
  const soundtrack = page.locator('#preview-soundtrack');
  await page.evaluate(() => { const { owner } = window.__audioOwner; owner.duck('ending', .4); owner.duck('call', .2); });
  expect(await soundtrack.evaluate(audio => audio.volume)).toBeCloseTo(.16);
  expect(await page.evaluate(() => window.__audioOwner.store.get('musicVolume'))).toBe(.8);
  expect(await playing(page)).toBe(true);

  // Reusing a token replaces its factor; it must not stack another multiplier.
  await page.evaluate(() => window.__audioOwner.owner.duck('call', .5));
  expect(await soundtrack.evaluate(audio => audio.volume)).toBeCloseTo(.32);
  await page.evaluate(() => window.__audioOwner.owner.duck('call', .2));
  await page.locator('.sound-settings-button').click();
  await page.locator('#preview-music-volume').fill('60');
  expect(await soundtrack.evaluate(audio => audio.volume)).toBeCloseTo(.12);
  expect(await page.evaluate(() => window.__audioOwner.store.get('musicVolume'))).toBe(.6);
  await page.evaluate(() => window.__audioOwner.owner.unduck('ending'));
  expect(await soundtrack.evaluate(audio => audio.volume)).toBeCloseTo(.12);
  await page.evaluate(() => { window.__audioOwner.owner.unduck('call'); window.__audioOwner.owner.unduck('unknown-token'); });
  expect(await soundtrack.evaluate(audio => audio.volume)).toBeCloseTo(.6);
  await expect(page.locator('.sound-volume-label output')).toHaveText('60%');
  expect(await page.evaluate(() => {
    const { element, source, position, loads } = window.__audioOwner;
    return element === document.querySelector('#preview-soundtrack') && element.src === source && element.currentTime >= position && loads() === 1;
  })).toBe(true);
  await expect(soundtrack).toHaveCount(1);
});

test('unducking never overrides media holds or a manual music pause', async ({ page }) => {
  await audioOwner(page);
  const soundtrack = page.locator('#preview-soundtrack');
  await page.evaluate(() => {
    const { owner } = window.__audioOwner;
    owner.duck('ending'); owner.hold('film'); owner.hold('call'); owner.unduck('ending');
  });
  await expect.poll(() => soundtrack.evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => window.__audioOwner.store.get('musicEnabled'))).toBe(true);
  expect(await soundtrack.evaluate(audio => audio.volume)).toBeCloseTo(.8);
  await page.evaluate(() => window.__audioOwner.owner.release('film'));
  expect(await soundtrack.evaluate(audio => audio.paused)).toBe(true);
  await page.evaluate(() => window.__audioOwner.owner.release('call'));
  await expect.poll(() => playing(page)).toBe(true);

  await page.evaluate(() => { const { owner } = window.__audioOwner; owner.duck('ending', .2); owner.hold('film'); });
  await page.locator('[data-audio-toggle]').click();
  expect(await page.evaluate(() => window.__audioOwner.store.get('musicEnabled'))).toBe(false);
  await page.evaluate(() => { const { owner } = window.__audioOwner; owner.release('film'); owner.unduck('ending'); owner.release('unknown-token'); });
  await expect.poll(() => soundtrack.evaluate(audio => audio.paused)).toBe(true);
  expect(await soundtrack.evaluate(audio => audio.volume)).toBeCloseTo(.8);
  expect(await page.evaluate(() => {
    const { element, source, loads, store } = window.__audioOwner;
    return element === document.querySelector('#preview-soundtrack') && element.src === source && loads() === 1
      && store.get('musicEnabled') === false && store.get('musicVolume') === .8;
  })).toBe(true);
});
