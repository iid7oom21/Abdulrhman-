import { test, expect } from '@playwright/test';

test('the homepage loads in Arabic without browser errors', async ({ page }) => {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()} (${message.location().url})`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#site-recovery')).toBeHidden();
  await expect(page).toHaveTitle('RAVEN — قصص سينمائية أصلية');

  // The soundtrack shell and the homepage it embeds should agree on the language.
  const home = page.frameLocator('#site-content');
  for (const html of [page.locator('html'), home.locator('html')]) {
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
  }
  await expect(home.getByRole('link', { name: 'الرئيسية', exact: true })).toBeVisible();
  const watch = home.getByRole('button', { name: 'فتح حلقات RAVEN 17', exact: true });
  await expect(watch).toBeVisible();
  await expect(watch).toHaveText('شاهد RAVEN 17');
  expect(errors, 'Errors reported while loading the homepage').toEqual([]);
});
