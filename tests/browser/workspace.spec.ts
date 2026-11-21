import { test, expect, type Page } from '@playwright/test';

const rectangle = (id: string, x: number, extra = {}) => ({ id, type: 'rectangle', x, y: 260, width: 120, height: 90, ...extra });
const project = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1') || '{}').project);
async function saved(page: Page) { await expect(page.locator('#save-state')).toHaveText('Saved on this device'); return project(page); }
async function seed(page: Page, elements: unknown[], theme = 'light') {
  await page.addInitScript(({ elements, theme }) => localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements, local: { sidebar: true, theme } })), { elements, theme });
  await page.goto('/'); await expect(page.locator('#workspace')).toBeVisible();
}
test('pages keep independent canvases and undo histories, and native saves include every page', async ({ page }) => {
  await seed(page, [rectangle('original', 500)]);
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByRole('button', { name: 'Ellipse', exact: true }).click(); await page.locator('#canvas').focus(); await page.keyboard.press('Enter');
  expect((await saved(page)).pages[1].elements[0].type).toBe('ellipse');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await saved(page)).pages[1].elements).toHaveLength(0);
  await page.getByRole('button', { name: 'Page 1', exact: true }).click(); expect((await saved(page)).pages[0].elements[0].id).toBe('original');
  await page.getByRole('button', { name: 'Page 2', exact: true }).click(); await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await saved(page);
  const download = page.waitForEvent('download'); await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+s');
  expect((await download).suggestedFilename()).toMatch(/\.sketchify$/);
});
test('layer dragging reparents objects, synchronizes selection, and moves properties to the right', async ({ page }) => {
  await seed(page, [rectangle('frame', 450, { type: 'frame', name: 'Container', width: 500, height: 240 }), rectangle('a', 500), rectangle('b', 700)]);
  const source = page.locator('[data-layer-key="e:a"] > .layer-row'), target = page.locator('[data-layer-key="e:frame"] > .layer-row');
  await source.dragTo(target);
  expect((await saved(page)).pages[0].elements.find((element: { id: string }) => element.id === 'a').frameId).toBe('frame');
  await page.locator('[data-layer-select="e:a"]').click();
  await expect(page.locator('[data-layer-select="e:a"]')).toHaveAttribute('aria-pressed', 'true');
  const inspector = await page.locator('#properties').boundingBox(); expect(inspector!.x).toBeGreaterThan(800);
  await page.locator('[data-layer-select="e:a"] > span').click();
  const name = page.getByRole('textbox', { name: 'Layer name', exact: true });
  await expect(name).toBeFocused();
  await name.fill('Component'); await page.keyboard.press('Enter');
  expect((await saved(page)).pages[0].layers['e:a'].name).toBe('Component');
  await page.getByRole('button', { name: 'Lock Container', exact: true }).click();
  await expect(source.getByRole('button', { name: 'Unlock Component', exact: true })).toBeDisabled();
  await page.locator('#canvas').focus(); await page.keyboard.press('Delete');
  expect((await saved(page)).pages[0].elements).toHaveLength(3);
});
test('page controls duplicate, rename, reorder and delete with confirmation', async ({ page }) => {
  await seed(page, [rectangle('a', 500)]);
  await page.getByRole('button', { name: 'Page actions for Page 1', exact: true }).click();
  await page.locator('.workspace-actions').getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.getByRole('button', { name: 'Page 1 copy', exact: true }).dblclick();
  await page.getByRole('textbox', { name: 'Page name', exact: true }).fill('Designs'); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Page actions for Designs', exact: true }).click();
  await page.locator('.workspace-actions').getByRole('button', { name: 'Move up', exact: true }).click();
  expect((await saved(page)).pages[0].name).toBe('Designs');
  await page.locator('.workspace-actions').getByRole('button', { name: 'Delete page', exact: true }).click();
  await expect(page.locator('#dialog')).toBeVisible(); expect((await project(page)).pages).toHaveLength(2);
  await page.locator('#confirm-delete-page').click(); expect((await saved(page)).pages).toHaveLength(1);
});
for (const theme of ['light', 'dark']) test(`mobile sidebar has reachable controls and no overflow in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page, [rectangle('a', 500, { groupIds: ['g'] }), rectangle('b', 700, { groupIds: ['g'] })], theme);
  for (const label of ['Collapse Group', 'Hide Group', 'Lock Group']) {
    const bounds = await page.getByRole('button', { name: label, exact: true }).boundingBox(); expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close sidebar', exact: true }).click(); await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.locator('#workspace-toggle')).toBeFocused();
});
