import { test, expect } from '@playwright/test';
for (const tool of ['Rectangle', 'Ellipse', 'Diamond', 'Line', 'Arrow', 'Draw', 'Text']) test(`${tool} rotates from its canvas handle and retains the angle after reload`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('#canvas')).toBeVisible();
  await page.getByRole('button', { name: tool, exact: true }).click(); await page.locator('#canvas').focus(); await page.keyboard.press('Enter');
  if (tool === 'Text') { await page.keyboard.type('Rotate me'); await page.getByRole('button', { name: 'Done', exact: true }).click(); }
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  const element = await page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements[0]);
  const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
  await page.mouse.move(center.x, element.y - 32); await page.mouse.down();
  await page.mouse.move(center.x + 100, center.y, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  const angle = () => page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements[0].angle);
  expect(Math.abs(await angle() - Math.PI / 2)).toBeLessThan(.02);
  await page.reload(); await expect(page.locator('#canvas')).toBeVisible();
  expect(Math.abs(await angle() - Math.PI / 2)).toBeLessThan(.02);
  expect(errors).toEqual([]);
});
