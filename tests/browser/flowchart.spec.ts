import { test, expect, type Page } from '@playwright/test';

const scene = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements);
async function saved(page: Page) {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return scene(page);
}
async function rootNode(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto('/');
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.mouse.move(400, 250); await page.mouse.down(); await page.mouse.move(560, 350); await page.mouse.up();
  return saved(page);
}

for (const modifier of ['Control', 'Meta']) test(`${modifier}+arrows previews siblings, commits on release, chains, undoes and reloads`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const original = await rootNode(page);
  await page.keyboard.down(modifier);
  for (let index = 0; index < 3; index++) await page.keyboard.press('ArrowRight');
  expect(await scene(page)).toEqual(original);
  await page.screenshot({ path: `artifacts/flowchart-${modifier.toLowerCase()}-preview.png` });
  await page.keyboard.up(modifier);
  const chart = await saved(page);
  expect(chart).toHaveLength(7);
  expect(chart.filter((element: { type: string }) => element.type === 'rectangle').map((element: { x: number; y: number }) => [element.x, element.y])).toEqual([[400, 250], [660, 50], [660, 250], [660, 450]]);
  for (const index of [2, 4, 6]) {
    expect(chart[index].startBinding.elementId).toBe(original[0].id);
    expect(chart[index].endBinding.elementId).toBe(chart[index - 1].id);
    expect(chart[index].elbowed).toBe(true);
  }
  await page.keyboard.press(`${modifier}+ArrowUp`);
  const extended = await saved(page); expect(extended).toHaveLength(9);
  expect(extended[8].startBinding.elementId).toBe(chart[1].id);
  await page.keyboard.press('ControlOrMeta+z'); expect(await saved(page)).toEqual(chart);
  await page.keyboard.press('ControlOrMeta+z'); expect(await saved(page)).toEqual(original);
  await page.keyboard.press('ControlOrMeta+Shift+z'); expect(await saved(page)).toEqual(chart);
  await page.reload(); expect(await saved(page)).toEqual(chart);
  expect(errors).toEqual([]);
});

test('Escape cancels previews; text editing and ordinary nudging retain their shortcuts', async ({ page }) => {
  const original = await rootNode(page);
  await page.keyboard.down('Control'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape'); await page.keyboard.up('Control');
  expect(await scene(page)).toEqual(original);
  await page.keyboard.press('ArrowRight'); expect((await saved(page))[0].x).toBe(original[0].x + 1);
  await page.keyboard.press('Enter');
  await expect(page.locator('#text-editor')).toBeFocused(); await page.locator('#text-editor').fill('Root label');
  await page.keyboard.press('Control+ArrowLeft');
  await expect(page.locator('#text-editor')).toBeFocused(); await expect(page.locator('#text-editor')).toHaveText('Root label');
  await page.keyboard.press('ControlOrMeta+Enter'); expect(await saved(page)).toHaveLength(2);
  await page.keyboard.press('Control+ArrowRight');
  const chart = await saved(page); expect(chart).toHaveLength(4); expect(chart[2].type).toBe('rectangle'); expect(chart[2].text).toBe('');
});
