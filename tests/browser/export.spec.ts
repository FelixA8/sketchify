import { test, expect, type Page } from '@playwright/test';

async function openExport(page: Page, theme = 'light', iconTextSize = 'medium') {
  await page.addInitScript(({ theme, iconTextSize }) => localStorage.setItem('sketchify.scene.v1', JSON.stringify({
    elements: [{ id: 'shape', type: 'rectangle', x: 400, y: 200, width: 240, height: 160, strokeColor: '#1b1b1f', backgroundColor: '#a5d8ff', fillStyle: 'solid', roughness: 0, seed: 12 }],
    local: { theme, iconTextSize },
  })), { theme, iconTextSize });
  await page.goto('/');
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await page.getByRole('button', { name: 'Export image', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Export image' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Export preview' })).toBeVisible();
}

for (const theme of ['light', 'dark']) for (const width of [320, 768, 1440]) test(`export controls, preview and keyboard work at ${width}px in ${theme}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 812 }); await openExport(page, theme);
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await expect(page.getByRole('switch', { name: 'Dark mode', exact: true })).toBeChecked({ checked: theme === 'dark' });
  for (const scale of [1, 2, 3]) {
    await dialog.getByRole('button', { name: `${scale}×`, exact: true }).click();
    await expect(dialog.getByRole('button', { name: `${scale}×`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#export-dimensions')).toHaveText(`${288 * scale} × ${208 * scale} px · PNG & clipboard`);
  }
  const background = page.getByRole('switch', { name: 'Background', exact: true });
  await background.focus(); await page.keyboard.press('Space'); await expect(background).not.toBeChecked();
  const dark = page.getByRole('switch', { name: 'Dark mode', exact: true });
  await dark.click(); await expect(dark).toBeChecked({ checked: theme !== 'dark' });
  for (const format of ['PNG', 'SVG']) {
    const downloading = page.waitForEvent('download'); await dialog.getByRole('button', { name: format, exact: true }).click();
    expect((await downloading).suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
  }
  await page.getByRole('combobox', { name: /Include/ }).click();
  await expect(page.getByRole('listbox', { name: 'Include', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'Entire page', exact: true }).click();
  await page.getByRole('button', { name: 'Save editable page (.excalidraw)', exact: true }).click();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  for (const control of ['PNG', 'SVG', 'Copy to clipboard']) {
    const bounds = await dialog.getByRole('button', { name: control, exact: true }).boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(43.95);
  }
  await page.screenshot({ path: `artifacts/export-${width}-${theme}.png` });
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); expect(errors).toEqual([]);
});

test('clipboard copies a real transparent PNG at the chosen scale', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Clipboard read permission is available in Chromium.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openExport(page);
  await page.getByRole('button', { name: '3×', exact: true }).click();
  await page.getByRole('switch', { name: 'Background', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Copy to clipboard', exact: true }).click();
  await expect(page.locator('.export-feedback')).toHaveText('PNG copied to clipboard.');
  const result = await page.evaluate(async () => {
    const items = await navigator.clipboard.read(), blob = await items[0].getType('image/png');
    const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, alpha: ctx.getImageData(0, 0, 1, 1).data[3] };
  });
  expect(result).toEqual({ width: 864, height: 624, alpha: 0 });
});

test('clipboard rejection provides a visible recovery message', async ({ page }) => {
  await openExport(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Permission denied'); } } }));
  await page.getByRole('button', { name: 'Copy to clipboard', exact: true }).click();
  await expect(page.locator('.export-feedback')).toContainText('download PNG instead');
  await expect(page.getByRole('button', { name: 'Copy to clipboard', exact: true })).toBeEnabled();
});

for (const theme of ['light', 'dark']) for (const [size, scale] of [['small', .675], ['medium', 1], ['large', 1.2]] as const) test(`custom scope options follow ${size} sizing and keyboard behavior in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await openExport(page, theme, size);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle pages and layers' }).click();
  await page.locator('[data-layer-select="e:shape"]').click();
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await page.getByRole('button', { name: 'Export image', exact: true }).click();
  const trigger = page.getByRole('combobox', { name: /Include/ });
  const bounds = await trigger.boundingBox();
  expect(bounds!.width).toBeCloseTo(180 * scale, 1); expect(bounds!.height).toBeCloseTo(32 * scale, 1);
  expect(await trigger.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(11 * scale, 1);
  await trigger.focus(); await page.keyboard.press('ArrowDown');
  const list = page.getByRole('listbox', { name: 'Include', exact: true });
  await expect(list).toBeVisible(); await expect(list.getByRole('option')).toHaveCount(2);
  await expect(list).toHaveCSS('background-color', theme === 'dark' ? 'rgb(35, 35, 41)' : 'rgb(255, 255, 255)');
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(trigger).toContainText('Selected elements'); await expect(trigger).toBeFocused(); await expect(list).toBeHidden();
  await trigger.click(); await expect(list).toBeVisible(); await trigger.press('Escape');
  await expect(list).toBeHidden(); await expect(page.getByRole('dialog', { name: 'Export image' })).toBeVisible();
  await trigger.click(); await page.getByRole('option', { name: 'Entire page', exact: true }).click();
  await expect(trigger).toContainText('Entire page'); await expect(trigger).toBeFocused();
  await trigger.click(); await expect(list).toBeVisible();
  await page.getByRole('img', { name: 'Export preview' }).click(); await expect(list).toBeHidden();
});
