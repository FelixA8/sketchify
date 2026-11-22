import { test, expect, type Page } from '@playwright/test';

const rectangle = (id: string, x: number, extra = {}) => ({ id, type: 'rectangle', x, y: 260, width: 120, height: 90, ...extra });
const project = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1') || '{}').project);
async function saved(page: Page) { await expect(page.locator('#save-state')).toHaveText('Saved on this device'); return project(page); }
async function seed(page: Page, elements: unknown[], theme = 'light', sidebarWidth?: number) {
  await page.addInitScript(({ elements, theme, sidebarWidth }) => localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements, local: { sidebar: true, theme, sidebarWidth } })), { elements, theme, sidebarWidth });
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
  await page.locator('[data-layer-select="e:a"] > svg').click();
  await expect(page.locator('[data-layer-select="e:a"]')).toHaveAttribute('aria-pressed', 'true');
  const inspector = await page.locator('#properties').boundingBox(); expect(inspector!.x).toBeGreaterThan(800);
  await source.locator('.layer-name').click();
  const name = page.getByRole('textbox', { name: 'Layer name', exact: true });
  await expect(name).toBeFocused();
  await name.fill('Component'); await page.keyboard.press('Enter');
  expect((await saved(page)).pages[0].layers['e:a'].name).toBe('Component');
  await target.hover();
  await page.getByRole('button', { name: 'Lock Container', exact: true }).click();
  await expect(source.locator('[aria-label="Unlock Component"]')).toBeDisabled();
  await page.locator('#canvas').focus(); await page.keyboard.press('Delete');
  expect((await saved(page)).pages[0].elements).toHaveLength(3);
});
for (const theme of ['light', 'dark']) {
  test(`layer icon centers and fits a partially covered shape on desktop in ${theme}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seed(page, [rectangle('clipped', 380, { width: 320, height: 240 })], theme, 400);
    const icon = page.getByRole('button', { name: 'Select and locate Rectangle on canvas', exact: true });
    const before = (await saved(page)).pages[0];
    await page.locator('[data-layer-key="e:clipped"] .layer-name').click();
    await expect(page.getByRole('textbox', { name: 'Layer name' })).toBeFocused();
    await page.keyboard.press('Escape');
    expect((await project(page)).pages[0].pan).toEqual(before.pan);
    expect((await project(page)).pages[0].zoom).toBe(before.zoom);
    await page.locator('#canvas').click({ position: { x: 740, y: 220 } });
    await expect(page.locator('#properties')).toBeHidden();

    await icon.press('Enter');
    await expect(icon).toHaveAttribute('aria-pressed', 'true');
    await expect(icon).toBeFocused();
    const sidebar = (await page.locator('#workspace').boundingBox())!;
    const inspector = (await page.locator('#properties').boundingBox())!;
    const toolbar = (await page.locator('#toolbar').boundingBox())!;
    const footer = (await page.locator('.bottom-left').boundingBox())!;
    const left = sidebar.x + sidebar.width, right = inspector.x, top = toolbar.y + toolbar.height;
    const finalZoom = Math.min((right - left - 72) / 320, (footer.y - top - 72) / 240);
    await expect.poll(async () => (await project(page)).pages[0].zoom).toBeCloseTo(finalZoom, 6);
    const view = (await saved(page)).pages[0];
    expect(view.zoom).toBeGreaterThan(before.zoom);
    expect(540 * view.zoom + view.pan.x).toBeCloseTo((left + right) / 2, 1);
    expect(380 * view.zoom + view.pan.y).toBeCloseTo((top + footer.y) / 2, 1);
    expect(380 * view.zoom + view.pan.x).toBeGreaterThan(left);
    expect(700 * view.zoom + view.pan.x).toBeLessThan(right);
    await page.screenshot({ path: `artifacts/layer-navigation-desktop-${theme}-${browserName}.png` });
  });

  test(`layer icon closes the mobile drawer and reveals an off-screen shape in ${theme}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page, [rectangle('far', 500, { width: 200, height: 120 })], theme);
    await saved(page);
    await page.getByRole('button', { name: 'Select and locate Rectangle on canvas', exact: true }).click();
    await expect(page.locator('#workspace')).toBeHidden();
    await expect(page.locator('#canvas')).toBeFocused();
    await expect.poll(async () => (await project(page)).pages[0].zoom).toBeCloseTo((375 - 72) / 200, 6);
    const view = (await saved(page)).pages[0];
    const header = (await page.locator('.top-left').boundingBox())!;
    const toolbar = (await page.locator('#toolbar').boundingBox())!;
    expect(view.zoom).toBeGreaterThan(1);
    expect(600 * view.zoom + view.pan.x).toBeCloseTo(375 / 2, 1);
    expect(320 * view.zoom + view.pan.y).toBeCloseTo((header.y + header.height + toolbar.y) / 2, 1);
    expect(500 * view.zoom + view.pan.x).toBeGreaterThan(0);
    expect(700 * view.zoom + view.pan.x).toBeLessThan(375);
    await page.screenshot({ path: `artifacts/layer-navigation-mobile-${theme}-${browserName}.png` });
  });
}
for (const reducedMotion of ['no-preference', 'reduce'] as const) test(`layer navigation follows the ${reducedMotion} motion preference`, async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion });
  await seed(page, [rectangle('far', 2500)]);
  await saved(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
  const paintTimes = reducedMotion === 'no-preference' ? await page.evaluateHandle(() => {
    const ctx = document.querySelector<HTMLCanvasElement>('#canvas')!.getContext('2d')!;
    const clearRect = ctx.clearRect.bind(ctx), times: number[] = [];
    ctx.clearRect = (x, y, width, height) => {
      times.push(performance.now());
      clearRect(x, y, width, height);
    };
    return times;
  }) : null;

  await page.getByRole('button', { name: 'Select and locate Rectangle on canvas', exact: true }).press('Enter');
  const zoom = page.locator('#zoom-reset');
  if (paintTimes) {
    await expect(zoom).toHaveText('100%');
    await page.clock.runFor(150);
    const halfway = Number.parseInt(await zoom.innerText(), 10);
    expect(halfway).toBeGreaterThan(100);
    expect(halfway).toBeLessThan(500);
    await page.clock.runFor(120);
    await expect(zoom).not.toHaveText('500%');
    await page.clock.runFor(70);
    const frames = await paintTimes.jsonValue();
    expect(new Set(frames).size).toBeGreaterThanOrEqual(17);
    const gaps = frames.slice(2).map((time, index) => time - frames[index + 1]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(17);
  }
  await expect(zoom).toHaveText('500%');
  await page.clock.runFor(300);
  expect((await saved(page)).pages[0].zoom).toBe(5);
});
test('layer hover eases in actions and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page, [rectangle('a', 500)]);
  const row = page.locator('[data-layer-key="e:a"] > .layer-row');
  const hide = row.locator('[aria-label="Hide Rectangle"]');
  await expect(hide).toBeHidden();
  await row.hover();
  await expect(hide).toBeVisible();
  await expect(hide).toHaveCSS('opacity', '1');
  await expect(hide).toHaveCSS('transition-property', /opacity/);
  await page.locator('#pages-heading').hover();
  await expect(hide).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await row.hover();
  await expect(hide).toBeVisible();
  await expect(hide).toHaveCSS('transition-duration', '0s');
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
