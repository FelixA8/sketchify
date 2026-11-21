import { test, expect, type Page } from '@playwright/test';

async function preferences(page: Page) {
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
}
async function fitsViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

for (const width of [375, 1440, 1600]) test(`panel icon and text sizes apply, fit and persist at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  await preferences(page);
  const options = page.getByRole('group', { name: 'Icon and text size', exact: true });
  await expect(options.getByRole('button', { name: 'Medium', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const [name, scale] of [['Small', .675], ['Large', 1.2], ['Medium', 1]] as const) {
    const button = options.getByRole('button', { name, exact: true });
    await button.focus(); await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const icon = page.locator('.preferences-head .icon-button svg').first();
    expect(await icon.evaluate(node => parseFloat(getComputedStyle(node).width))).toBeCloseTo(14 * scale);
    expect(await button.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(11 * scale);
    for (const selector of ['#menu-button svg', '#zoom-out svg', '#zoom-in svg', '#fit-button svg', '#undo-button svg', '#redo-button svg', '#help-button svg']) {
      const glyph = page.locator(selector), expected = (width <= 760 ? 20 : 16) * scale;
      expect(await glyph.evaluate(node => parseFloat(getComputedStyle(node).width))).toBeCloseTo(expected);
      expect(await glyph.evaluate(node => parseFloat(getComputedStyle(node).height))).toBeCloseTo(expected);
    }
    const toolIcon = page.locator('[data-tool="rectangle"] svg');
    expect((await toolIcon.boundingBox())!.width).toBeCloseTo((width <= 760 ? 20 : 16) * scale, 1);
    expect(await page.locator('#zoom-reset').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo((width <= 760 ? 12 : 11) * scale);
    const cornerSize = (width <= 760 ? 42 : width >= 1500 ? 43.2 : 40) * scale;
    const menuButton = (await page.locator('#menu-button').boundingBox())!;
    expect(menuButton.width).toBeCloseTo(cornerSize, 1); expect(menuButton.height).toBeCloseTo(cornerSize, 1);
    const zoomButton = (await page.locator('#zoom-out').boundingBox())!;
    expect(zoomButton.width).toBeCloseTo((width <= 760 ? 32 : width >= 1500 ? 35.2 : 32) * scale, 1);
    expect(zoomButton.height).toBeCloseTo((width <= 760 ? 40 : width >= 1500 ? 35.2 : 32) * scale, 1);
    const toolButton = (await page.locator('[data-tool="rectangle"]').boundingBox())!;
    expect(toolButton.width).toBeCloseTo((width <= 760 ? 39 : width >= 1500 ? 35.2 : 32) * scale, 1);
    expect(toolButton.height).toBeCloseTo((width <= 760 ? 42 : width >= 1500 ? 35.2 : 32) * scale, 1);
    const helpButton = (await page.locator('#help-button').boundingBox())!;
    expect(helpButton.width).toBeCloseTo((width <= 760 ? 38 : width >= 1500 ? 43.2 : 40) * scale, 1);
    expect(helpButton.height).toBeCloseTo(cornerSize, 1);
    if (width > 760) for (const selector of ['.zoom-controls', '.history-controls', '#toolbar']) expect((await page.locator(selector).boundingBox())!.height).toBeCloseTo(cornerSize, 1);
    if (width <= 760) expect(await page.locator('#style-toggle svg').evaluate(node => parseFloat(getComputedStyle(node).width))).toBeCloseTo(20 * scale);
    for (const selector of ['.zoom-controls', '.history-controls', '#help-button', '#toolbar']) await fitsViewport(page, selector);
    if (width === 375) expect((await button.boundingBox())!.height).toBeCloseTo(44 * scale, 1);
    await fitsViewport(page, '#menu');
    expect((await page.locator('#menu').boundingBox())!.width).toBeCloseTo(Math.min(width - 24, name === 'Small' ? 255 : 340), 1);
    await expect(page.locator('#save-state')).toHaveText('Saved on this device');
    await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-panel-size', name.toLowerCase());
    await preferences(page);
    await expect(options.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
});

for (const width of [375, 820, 1440]) for (const theme of ['light', 'dark']) test(`Preferences switches, panels and zen mode at ${width}px in ${theme}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  if (theme === 'dark') {
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.locator('#canvas').focus(); await page.keyboard.press('Enter');
  await preferences(page);
  const menu = page.getByRole('region', { name: 'Preferences', exact: true });
  await expect(menu.getByRole('switch')).toHaveCount(6);
  await expect(menu.getByRole('button', { name: 'Back to settings' })).toBeFocused();
  await fitsViewport(page, '#menu');
  for (const name of ['Minimap', 'Canvas & shape properties', 'Grid']) {
    const toggle = menu.getByRole('switch', { name, exact: true });
    await toggle.focus(); await page.keyboard.press('Space'); await expect(toggle).toBeChecked();
    await expect(toggle).toBeFocused();
  }
  for (const name of ['Arrow binding', 'Toolbar hints']) {
    const toggle = menu.getByRole('switch', { name, exact: true });
    await toggle.click(); await expect(toggle).not.toBeChecked();
  }
  await page.screenshot({ path: `artifacts/preferences-${width}-${theme}.png` });
  await page.keyboard.press('Escape'); await expect(page.locator('#menu-button')).toBeFocused();
  await expect(page.locator('#minimap')).toBeVisible(); await expect(page.locator('#canvas-properties')).toBeVisible();
  await expect(page.locator('#tool-hint')).toBeHidden();
  await fitsViewport(page, '#minimap'); await fitsViewport(page, '#canvas-properties');
  const map = page.getByRole('button', { name: 'Navigate canvas with minimap' });
  await map.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Home');
  await page.reload(); await expect(page.locator('#minimap')).toBeVisible(); await expect(page.locator('#canvas-properties')).toBeVisible();
  await expect(page.locator('#tool-hint')).toBeHidden();
  await preferences(page); await page.getByRole('switch', { name: 'Zen mode', exact: true }).click();
  await expect(page.locator('#toolbar')).toBeHidden(); await expect(page.locator('#minimap')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exit zen mode' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.locator('#minimap')).toBeVisible();
  await page.screenshot({ path: `artifacts/canvas-overview-${width}-${theme}.png` });
  if (width === 375) {
    await page.locator('[data-tool="rectangle"]').click(); await page.locator('#style-toggle').click();
    await expect(page.locator('#properties')).toBeVisible(); await expect(page.locator('.canvas-overview')).toBeHidden();
    await page.locator('#style-toggle').click(); await expect(page.locator('.canvas-overview')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
