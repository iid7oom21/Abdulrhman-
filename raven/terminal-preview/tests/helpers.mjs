import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { test, expect } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
export const PREVIEW = process.env.RAVEN_PREVIEW_URL || 'http://127.0.0.1:8786/raven/terminal-preview/';
export const route = path => new URL(path, PREVIEW).href;
export const CASE = route('case-017/');
export const EXPANSION_KEY = 'raven-preview:v1:case-017:expansion-v3';
export async function boot(page, path = '') {
  await page.goto(route(path), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main#route-outlet')).toBeVisible();
  await expect(page.locator('#preview-soundtrack')).toHaveCount(1);
  if (path.startsWith('case-017')) await expect(page.locator('.case-page')).toBeVisible();
}
export async function caseState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), EXPANSION_KEY);
}
export async function selectCaseTab(page, name) {
  const button = page.locator(`[data-case-tab="${name}"]`);
  await button.click();
}
export async function openEvidence(page, id) {
  if (!(await page.locator(`[data-evidence-id="${id}"]:visible`).count())) await selectCaseTab(page, 'evidence');
  await page.locator(`[data-evidence-id="${id}"]:visible`).first().click();
  await expect(page.locator('.case-dialog[open]')).toBeVisible();
}
export async function closeEvidence(page) {
  await page.getByRole('button', { name: 'إغلاق الوثيقة', exact: true }).click();
}
export async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
export async function previewStorage(page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(localStorage)
    .filter(([key]) => key.startsWith('raven-preview:v1'))
    .map(([key, value]) => {
      try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
    })));
}
