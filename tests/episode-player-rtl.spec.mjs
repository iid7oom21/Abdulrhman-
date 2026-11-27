import { test, expect } from '@playwright/test';

const statusCopy = 'تبدأ الحلقة عند عودة المحقق إلى المدينة بعد غياب طويل، فيجد رسالة مجهولة تركت قرب باب المنزل. تقوده الرسالة إلى تسجيل قديم يكشف تفاصيل لم ينتبه إليها في المرة الأولى، ويعيد ترتيب الأحداث التي ظن أنه فهمها. شاهد حتى النهاية لتكتشف كيف ترتبط الإشارات الصغيرة في المشاهد الأولى بالقرار الذي يغير مسار التحقيق.';
const detailsCopy = 'تدور الحكاية في ليلة واحدة، لكن كل مشهد يضيف رواية جديدة لما حدث قبل وصول المحقق إلى الأرشيف. انتبه إلى الأصوات القادمة من الغرفة المجاورة وإلى التوقيت المكتوب على كل تسجيل، فبعض الأدلة لا تظهر إلا عندما تقارن ما تسمعه بما تراه على الشاشة. يمكن متابعة الحلقة دون معرفة الحكاية مسبقًا، ثم العودة إلى المشاهد الأولى بعد النهاية لمراجعة التفاصيل التي بدت عابرة.';

async function expectWrappedRtlText(locator, copy) {
  await expect(locator).toBeVisible();
  await expect(locator).toHaveText(copy);
  await expect(locator).toHaveCSS('direction', 'rtl');

  const layout = await locator.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = Array.from(range.getClientRects());
    const bounds = element.getBoundingClientRect();
    return {
      lines: new Set(lines.map(line => Math.round(line.top))).size,
      fits: lines.every(line => line.left >= bounds.left - 1 && line.right <= bounds.right + 1),
    };
  });
  expect(layout.lines, 'Long Arabic copy should wrap onto multiple lines').toBeGreaterThan(1);
  expect(layout.fits, 'All rendered text should fit within its container').toBe(true);
}

for (const viewport of [{ width: 320, height: 740 }, { width: 1280, height: 800 }]) {
  test.describe(`Episode player RTL at ${viewport.width}px`, () => {
    test.use({ viewport, reducedMotion: 'reduce' });

    test('wraps long Arabic copy without horizontal overflow or blocking controls', async ({ page }) => {
      await page.goto('/?episode=1');
      await expect(page.locator('#site-recovery')).toBeHidden();
      const home = page.frameLocator('#site-content');
      const dialog = home.getByRole('dialog', { name: 'حلقات RAVEN 17' });
      const frameRoot = home.locator('html');
      await expect(frameRoot).toHaveAttribute('lang', 'ar');
      await expect(frameRoot).toHaveAttribute('dir', 'rtl');

      const status = dialog.locator('#rvnEpisodeStatus');
      await expect(status).toHaveText('الحلقة 1');
      const details = dialog.locator('.rvnFileInfo');
      await details.locator('summary').click();
      await expect(details).toHaveAttribute('open', '');
      const description = details.locator('[data-rvn-v2="fileCopy"]');

      // Stress the actual player text containers without changing production translations.
      await status.evaluate((element, copy) => { element.textContent = copy; }, statusCopy);
      await description.evaluate((element, copy) => { element.textContent = copy; }, detailsCopy);
      await expectWrappedRtlText(status, statusCopy);
      await expectWrappedRtlText(description, detailsCopy);

      for (const [label, locator] of [['shell', page.locator('html')], ['embedded page', frameRoot], ['dialog', dialog]]) {
        const overflow = await locator.evaluate(element => element.scrollWidth - element.clientWidth);
        expect(overflow, `${label} should not scroll horizontally`).toBeLessThanOrEqual(1);
      }
      await expect(dialog.locator('#ravenEpisodePlayer')).toBeVisible();
      await dialog.locator('#rvnNextEpisode').click();
      await expect(status).toHaveText('الحلقة 2');
      await dialog.getByRole('button', { name: 'إغلاق', exact: true }).click();
      await expect(dialog).toBeHidden();
    });
  });
}
