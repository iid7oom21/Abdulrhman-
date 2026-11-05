// Run against a served repository root. Remote film URLs retain their identity;
// playback uses a temporary native video fixture, never a production replacement.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium, webkit, expect } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
const base = process.env.RAVEN_LEGACY_URL || 'http://127.0.0.1:8786/raven/';
const work = mkdtempSync(join(tmpdir(), 'raven-legacy-episodes-'));
const fixture = join(work, 'playback.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=2', '-t', '180', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', fixture]);
const browser = await (process.env.RAVEN_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    sessionStorage.setItem('raven_music_enabled_v2', 'off');
    sessionStorage.setItem('raven_studio_ident_v1', '1');
    if (!localStorage.getItem('legacy-episode-test-seeded')) {
      for (const [id, time] of [[1, 31], [2, 42], [3, 72]]) {
        localStorage.setItem(`raven17_episode_${id}_progress`, String(time));
        localStorage.setItem(`raven_episode_note_${id}`, `original-film-${id}`);
      }
      localStorage.setItem('legacy-episode-test-seeded', '1');
    }
  });
  const requestedFilms = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (/\/episode-\d\.mp4/.test(url.pathname)) {
      requestedFilms.push(url.pathname);
      const body = readFileSync(fixture);
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
      if (range) {
        const start = Number(range[1]), end = range[2] ? Number(range[2]) : body.length - 1;
        return route.fulfill({ status:206, contentType:'video/mp4', headers:{ 'accept-ranges':'bytes', 'content-range':`bytes ${start}-${end}/${body.length}` }, body:body.subarray(start,end+1) });
      }
      return route.fulfill({ contentType: 'video/mp4', headers:{'accept-ranges':'bytes'}, body });
    }
    if (url.origin !== new URL(base).origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(new URL('?episode=1', base).href, { waitUntil: 'domcontentloaded' });
  const frame = await (await page.locator('#site-content').elementHandle()).contentFrame();
  await frame.waitForFunction(() => document.documentElement.dataset.ravenRefinement === '2');
  const video = frame.locator('#ravenEpisodePlayer');
  await expect(frame.locator('[data-rvn-episode]')).toHaveCount(2);
  await expect(video).toHaveAttribute('src', /episode-2\.mp4$/);
  await expect(frame.locator('#rvnEndNote')).toHaveValue('original-film-2');
  await frame.locator('[data-rvn-episode="1"]').click();
  await expect.poll(() => video.evaluate(v => Math.floor(v.currentTime))).toBe(42).catch(async error => { console.error(await video.evaluate(v => ({time:v.currentTime,duration:v.duration,src:v.src,keys:Object.fromEntries(Object.entries(localStorage)),note:document.querySelector('#rvnResumeNote').textContent,seekable:Array.from({length:v.seekable.length},(_,i)=>[v.seekable.start(i),v.seekable.end(i)])}))); throw error; });
  await video.evaluate(v => { v.currentTime = 55; v.pause(); });
  await expect.poll(() => frame.evaluate(() => localStorage.getItem('raven17_episode_2_progress'))).toBe('55');
  assert.equal(await frame.evaluate(() => localStorage.getItem('raven17_episode_1_progress')), '31');
  assert.equal(await frame.evaluate(() => localStorage.getItem('raven17_episode_3_progress')), '72');
  await video.evaluate(async v => { v.currentTime = v.duration - 0.1; await v.play(); });
  await expect(frame.locator('#rvnAfterCredits')).toBeVisible();
  await frame.locator('#rvnAfterCredits details summary').click();
  await frame.locator('#rvnEndNote').fill('new-note-for-original-2');
  assert.equal(await frame.evaluate(() => localStorage.getItem('raven_episode_note_2')), 'new-note-for-original-2');
  await frame.locator('#rvnAfterNext').click();
  await expect(video).toHaveAttribute('src', /episode-3\.mp4$/);
  await expect(frame.locator('#rvnEndNote')).toHaveValue('original-film-3');
  await expect.poll(() => video.evaluate(v => Math.floor(v.currentTime))).toBe(72);
  await expect(frame.locator('#rvnNextEpisode')).toBeDisabled();
  await video.evaluate(async v => { v.currentTime = v.duration - 0.1; await v.play(); });
  await expect(frame.locator('#rvnAfterCredits')).toBeVisible();
  await expect(frame.locator('#rvnAfterNext')).toBeHidden();
  await frame.locator('#rvnEndNote').fill('new-note-for-original-3');
  assert.equal(await frame.evaluate(() => localStorage.getItem('raven_episode_note_3')), 'new-note-for-original-3');
  assert.equal(await frame.evaluate(() => localStorage.getItem('raven_episode_note_1')), 'original-film-1');
  assert.equal(await page.locator('#site-soundtrack').evaluate(v => v.paused), true);
  assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  assert.ok(!requestedFilms.some(url => /episode-1\.mp4/.test(url)));

  // Old third-part links remain useful and language switching uses the new order.
  await page.goto(new URL('?episode=3&lang=en', base).href, { waitUntil: 'domcontentloaded' });
  const legacy = await (await page.locator('#site-content').elementHandle()).contentFrame();
  await legacy.waitForFunction(() => document.documentElement.dataset.ravenRefinement === '2');
  await expect(legacy.locator('#ravenEpisodePlayer')).toHaveAttribute('src', /episode-3\.mp4$/);
  await expect(legacy.locator('#rvnEpisodeStatus')).toHaveText('Episode 2');
  await expect(legacy.locator('[data-rvn-i18n="filmsIntro"]')).toHaveText('Two episodes. Begin with episode one.');
  await expect.poll(() => legacy.evaluate(() => new URL(location.href).searchParams.get('episode'))).toBe('2');
  assert.equal(await legacy.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  console.log('PASS: two legacy episodes, native playback/resume, original-film notes, terminal next button, old-third-link alias, English copy, music-off and 320px layout.');
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
