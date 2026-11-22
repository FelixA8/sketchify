import { test, expect, type Page } from '@playwright/test';
import { seedStorage } from './storage';

async function seed(page: Page) {
  await seedStorage(page, { elements: [
    { id: 'box', type: 'rectangle', x: 400, y: 250, width: 200, height: 140, backgroundColor: '#ffec99', seed: 17 },
    { id: 'label', type: 'text', x: 440, y: 290, text: 'Right-click me', fontSize: 24, fontFamily: 2, containerId: 'box' },
  ] });
  await page.goto('/'); await expect(page.locator('#canvas')).toBeVisible();
}
async function scene(page: Page) {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements);
}

test('context menu supports native right-click, keyboard navigation, duplicate and undo', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await seed(page); await page.mouse.click(410, 350, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Object actions' }); await expect(menu).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Cut/ })).toBeFocused();
  await page.keyboard.press('End'); await expect(page.getByRole('menuitem', { name: /^Delete/ })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(menu).toBeHidden(); await expect(page.locator('#canvas')).toBeFocused();
  await page.mouse.click(410, 350, { button: 'right' }); await page.getByRole('menuitem', { name: /^Duplicate/ }).click();
  expect(await scene(page)).toHaveLength(4);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await scene(page)).toHaveLength(2);
  await page.mouse.click(410, 350, { button: 'right' }); await page.screenshot({ path: 'artifacts/context-menu-desktop.png' });
  expect(errors).toEqual([]);
});

test('lock/unlock, text unbinding, frames and object links are usable from the menu', async ({ page }) => {
  await seed(page);
  const open = () => page.mouse.click(410, 350, { button: 'right' });
  await open(); await page.getByRole('menuitem', { name: /^Lock/ }).click();
  await open(); await expect(page.getByRole('menuitem', { name: /^Delete/ })).toBeDisabled();
  await page.getByRole('menuitem', { name: /^Unlock/ }).click();
  await open(); await page.getByRole('menuitem', { name: 'Unbind text' }).click();
  expect((await scene(page))[1].containerId).toBeNull();
  await open(); await page.getByRole('menuitem', { name: /^Add link/ }).click();
  const input = page.getByRole('textbox', { name: 'Link address' }); await expect(input).toBeFocused();
  await input.fill('https://example.com/'); await page.getByRole('button', { name: 'Save link', exact: true }).click();
  expect((await scene(page))[0].link).toBe('https://example.com/');
  await open(); await page.getByRole('menuitem', { name: 'Wrap selection in frame' }).click();
  const wrapped = await scene(page);
  expect(wrapped[0].type).toBe('frame');
  await page.getByRole('button', { name: 'Rename frame: Frame', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Frame name', exact: true });
  await expect(name).toBeFocused();
  expect(await name.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([0, 5]);
  await name.fill('Project notes'); await name.press('Enter');
  await expect(name).toBeHidden(); await expect(page.locator('#canvas')).toBeFocused();
  expect(await scene(page)).toEqual(wrapped.map((element: { type: string }) => element.type === 'frame' ? { ...element, name: 'Project notes' } : element));
  await page.keyboard.press('ControlOrMeta+z'); expect((await scene(page))[0].name).toBe('Frame');
  await page.keyboard.press('ControlOrMeta+Shift+z'); expect((await scene(page))[0].name).toBe('Project notes');
  await page.getByRole('button', { name: 'Rename frame: Project notes', exact: true }).focus();
  await page.keyboard.press('Enter'); await name.fill('Discard this'); await name.press('Escape');
  expect((await scene(page))[0].name).toBe('Project notes');
  await page.keyboard.press('Enter'); await expect(name).toBeFocused();
  await name.fill('Final notes'); await page.mouse.click(900, 500);
  expect((await scene(page))[0].name).toBe('Final notes');
  await page.reload(); await expect(page.getByRole('button', { name: 'Rename frame: Final notes', exact: true })).toBeVisible();
});

test('frame name follows rotation, pan and zoom on a narrow canvas', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await seedStorage(page, { elements: [
    { id: 'frame', type: 'frame', name: 'Frame', x: 100, y: 150, width: 200, height: 200, angle: Math.PI / 6 },
  ], local: { zoom: 0.75, pan: { x: 30, y: 100 } } });
  await page.goto('/');
  const label = page.getByRole('button', { name: 'Rename frame: Frame', exact: true });
  await label.click();
  const name = page.getByRole('textbox', { name: 'Frame name', exact: true });
  await expect(name).toBeFocused(); await name.fill('Phone sketch'); await name.press('Enter');
  expect((await scene(page))[0]).toMatchObject({ name: 'Phone sketch', x: 100, y: 150, width: 200, height: 200, angle: Math.PI / 6 });
  await page.getByRole('button', { name: 'Rename frame: Phone sketch', exact: true }).click();
  await name.fill('   '); await name.press('Enter'); expect((await scene(page))[0].name).toBe('Frame');
});

for (const width of [1280, 375]) for (const zoom of [0.75, 1, 2]) test(`frame rename keeps its text position at ${width}px and ${zoom} zoom`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await seedStorage(page, { elements: [
    { id: 'frame', type: 'frame', name: 'Cash List', x: 100, y: 150, width: 200, height: 200, angle: Math.PI / 12 },
  ], local: { zoom, pan: { x: width === 375 && zoom === 2 ? -30 : 30, y: 100 } } });
  await page.goto('/');
  const label = page.getByRole('button', { name: 'Rename frame: Cash List', exact: true });
  const origin = await label.evaluate((button: HTMLButtonElement) => {
    const style = getComputedStyle(button);
    return { x: button.offsetLeft, y: button.offsetTop + button.offsetHeight - parseFloat(style.lineHeight), font: style.font };
  });
  const anchor = await page.locator('.frame-name-position').boundingBox();
  await label.click();
  const name = page.getByRole('textbox', { name: 'Frame name', exact: true });
  await expect(name).toBeFocused();
  const editing = await name.evaluate((input: HTMLInputElement) => {
    const style = getComputedStyle(input);
    return { x: input.offsetLeft + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
      y: input.offsetTop + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop), font: style.font };
  });
  expect(editing.x).toBeCloseTo(origin.x, 0);
  expect(editing.y).toBeCloseTo(origin.y, 0);
  expect(editing.font).toBe(origin.font);
  await expect(name).toHaveCSS('outline-style', 'none');
  await expect(name).toHaveCSS('border-top-style', 'solid');
  await expect(name).toHaveCSS('border-top-width', '1px');
  expect(await page.locator('.frame-name-position').boundingBox()).toEqual(anchor);
  if (width === 375) expect((await name.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await name.fill('Cash'); await name.press('Enter');
  await page.getByRole('button', { name: 'Rename frame: Cash', exact: true }).click();
  await name.fill('Discard'); await name.press('Escape');
  await expect(page.getByRole('button', { name: 'Rename frame: Cash', exact: true })).toBeVisible();
});

test('menu stays inside a narrow viewport and remains scrollable with keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 }); await seed(page);
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Object actions' }); await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375); expect(box.y + box.height).toBeLessThanOrEqual(700);
  await page.keyboard.press('End'); await expect(page.getByRole('menuitem', { name: /^Delete/ })).toBeInViewport();
  await page.screenshot({ path: 'artifacts/context-menu-mobile.png' });
});
