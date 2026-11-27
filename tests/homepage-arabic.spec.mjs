import { test, expect } from '@playwright/test';

function collectBrowserErrors(page) {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()} (${message.location().url})`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('the homepage loads in Arabic without browser errors', async ({ page }) => {
  const errors = collectBrowserErrors(page);
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

test('the homepage switches back to Arabic in place and keeps the current URL context', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/?from=locale-test');
  await expect(page.locator('#site-recovery')).toBeHidden();
  const home = page.frameLocator('#site-content');
  const english = home.getByRole('link', { name: 'Read in English', exact: true });
  const arabic = home.getByRole('link', { name: 'اقرأ بالعربية', exact: true });
  const arabicURL = page.url();
  const englishURL = new URL(arabicURL);
  englishURL.searchParams.set('lang', 'en');
  const navigationRequests = [];
  page.on('request', request => {
    if (request.isNavigationRequest()) navigationRequests.push(request.url());
  });

  await expect(english).toHaveAttribute('href', englishURL.pathname + englishURL.search + englishURL.hash);
  await english.click();
  await expect(page).toHaveURL(englishURL.href);
  await expect(page).toHaveTitle('RAVEN — Original Cinematic Stories');
  await expect(english).toHaveAttribute('aria-current', 'page');
  await expect(home.getByRole('link', { name: 'Home', exact: true })).toBeVisible();

  await arabic.click();
  await expect(page).toHaveURL(arabicURL);
  await expect(page).toHaveTitle('RAVEN — قصص سينمائية أصلية');
  for (const html of [page.locator('html'), home.locator('html')]) {
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
  }
  await expect(arabic).toHaveAttribute('aria-current', 'page');
  await expect(english).not.toHaveAttribute('aria-current', 'page');
  await expect(home.getByRole('link', { name: 'الرئيسية', exact: true })).toBeVisible();
  expect(navigationRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('the episode switcher returns to Arabic without closing the episode', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/?lang=en&episode=1');
  await expect(page.locator('#site-recovery')).toBeHidden();
  const home = page.frameLocator('#site-content');
  const dialog = home.getByRole('dialog', { name: 'RAVEN 17 episodes' });
  await dialog.getByRole('link', { name: 'اقرأ بالعربية', exact: true }).click();

  const arabicDialog = home.getByRole('dialog', { name: 'حلقات RAVEN 17' });
  await expect(arabicDialog).toBeVisible();
  await expect(arabicDialog.getByText('الحلقة 1', { exact: true })).toBeVisible();
  await expect(arabicDialog.getByRole('link', { name: 'اقرأ بالعربية', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveURL(/\/raven\/\?episode=1#top$/);
  expect(errors).toEqual([]);
});
