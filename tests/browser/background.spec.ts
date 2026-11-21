import { test, expect } from '@playwright/test';

for (const width of [375, 1440]) test(`canvas backgrounds follow theme, selection and reload at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
  for (const [light, dark, rgb] of [
    ['#ffffff', '#121212', 'rgb(18, 18, 18)'],
    ['#f8f9fa', '#1e1e1e', 'rgb(30, 30, 30)'],
    ['#fffce8', '#292719', 'rgb(41, 39, 25)'],
    ['#edf2ff', '#1c2333', 'rgb(28, 35, 51)'],
    ['#f3faf5', '#1b2921', 'rgb(27, 41, 33)'],
  ]) {
    const swatch = page.getByRole('button', { name: `Canvas ${dark}`, exact: true });
    await expect(swatch).toHaveCSS('background-color', rgb);
    await swatch.click();
    await expect(swatch).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#app')).toHaveCSS('background-color', rgb);
    await expect(page.locator('html')).toHaveCSS('background-color', rgb);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', dark);
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.getByRole('button', { name: `Canvas ${light}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveCSS('--canvas', light);
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
  }
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();
  await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(27, 41, 33)');
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Canvas #1b2921', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByRole('switch', { name: 'Minimap', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#minimap canvas')).toHaveCSS('background-color', 'rgb(27, 41, 33)');
  await page.screenshot({ path: `artifacts/canvas-background-${width}-dark.png` });
});
