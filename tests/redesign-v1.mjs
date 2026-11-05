// RAVEN homepage redesign v1: presentation checks against a served repository root.
// Run: RAVEN_REDESIGN_URL=http://127.0.0.1:8080/ node tests/redesign-v1.mjs
// Checks that the artwork bytes are unchanged, the hero frame keeps its contained ratio,
// no text is below 11px, no horizontal scroll at 320/390/1366, and the music bar still works.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
const base = (process.env.RAVEN_REDESIGN_URL || 'http://127.0.0.1:8080/').replace(/\/?$/, '/');
const repoRoot = new URL('..', import.meta.url).pathname;

// Artwork that must stay byte-identical to the approved files.
const PINNED = {
  'assets/raven-home-share.jpg': 'bd4f79aa8cc65d6828b1f4310a1b66c9bd7d639a7c43bce8005dfdb7f47a1547',
  'assets/intro/raven-intro.jpg': '4b54c40b0e0a13daee2f4f6def71e88ffb640122ecded31f63c188dac68743a5',
  'raven/terminal-preview/assets/raven-intro-poster.jpg': '54511f8eedff55b8419c797f1348f9361bc07c6c011b46f2938ede3b92e213ca',
  'raven/terminal-preview/assets/hero-poster.jpg': '8470eab08bec6cd3d4a7dabb9575412a6146445d5adadf1588d9691eb9922e8b',
};
for (const [file, sha] of Object.entries(PINNED)) {
  const got = createHash('sha256').update(readFileSync(new URL(file, 'file://' + repoRoot))).digest('hex');
  assert.equal(got, sha, `artwork changed: ${file}`);
}
console.log('PASS: artwork bytes match the pinned SHA-256 values');

const browser = await chromium.launch({ headless: true });
try {
  for (const [label, width, height] of [['320', 320, 640], ['390', 390, 844], ['1366', 1366, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'ar-SA' });
    await context.addInitScript(() => {
      try { sessionStorage.setItem('raven_studio_ident_v1', '1'); } catch (_) {}
      try { if (!localStorage.getItem('redesign-v1-seeded')) { localStorage.setItem('raven_music_track_v1', '4'); localStorage.setItem('redesign-v1-seeded', '1'); } } catch (_) {}
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(base + 'raven/content.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const metrics = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const small = [];
      for (const el of document.querySelectorAll('body *')) {
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const fs = parseFloat(cs.fontSize);
        if (fs < 11) small.push(`${fs}px ${el.className || el.tagName}`);
      }
      const hero = document.querySelector('.refHeroVideo');
      return { overflow, small, fit: hero && getComputedStyle(hero).objectFit, ratio: getComputedStyle(document.querySelector('.refHeroBg')).aspectRatio };
    });
    assert.equal(metrics.overflow, 0, `${label}px: horizontal scroll ${metrics.overflow}px`);
    assert.deepEqual(metrics.small, [], `${label}px: text under 11px: ${metrics.small.slice(0, 5).join(', ')}`);
    assert.equal(metrics.fit, 'contain', `${label}px: hero must keep object-fit: contain`);
    console.log(`PASS: ${label}px layout — no horizontal scroll, no text under 11px, hero contained`);

    if (label === '390') {
      // The music bar lives in the parent shell (raven/index.html), not in content.html.
      await page.goto(base + 'raven/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const picker = await page.locator('#music-track-picker option').count();
      assert.equal(picker, 13, 'the player must list 13 tracks');
      const number = (await page.locator('#music-track-number').textContent()) || '';
      assert.match(number, /^5 /, `saved track index must be honoured, got "${number}"`);
      await page.locator('#music-next').click({ force: true });
      await page.waitForTimeout(300);
      const after = (await page.locator('#music-track-number').textContent()) || '';
      assert.notEqual(after, number, 'next button must change the track');
      console.log('PASS: music bar lists 13 tracks, honours the saved track, and "next" works');
    }
    assert.deepEqual(errors, [], `${label}px: uncaught page errors: ${errors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('\nALL CHECKS PASSED');
