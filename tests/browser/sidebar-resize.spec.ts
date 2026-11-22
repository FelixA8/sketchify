import { test, expect, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function seed(page: Page, local = {}) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(local => {
    if (sessionStorage.getItem('sidebar-resize-seeded')) return;
    localStorage.setItem('sketchify.scene.v1', JSON.stringify({
      elements: [{ id: 'wide', type: 'rectangle', x: 500, y: 260, width: 1200, height: 90 }],
      local: { sidebar: true, ...local },
    }));
    sessionStorage.setItem('sidebar-resize-seeded', 'true');
  }, local);
  await page.goto('/');
  await expect(page.locator('#workspace')).toBeVisible();
}
const edge = (page: Page) => page.getByRole('separator', { name: 'Resize pages and layers' });
const width = (page: Page) => page.locator('#workspace').evaluate(node => node.getBoundingClientRect().width);
async function saved(page: Page) {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!));
}
async function drag(page: Page, targetWidth: number, release = true) {
  const handle = (await edge(page).boundingBox())!, current = await width(page);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + targetWidth - current, handle.y + handle.height / 2, { steps: 8 });
  if (release) await page.mouse.up();
}

test('edge dragging persists across closing, switching pages and refresh; double-click resets', async ({ page }) => {
  await seed(page);
  const before = await saved(page);
  await expect.poll(() => width(page)).toBe(168);
  await edge(page).hover();
  await expect(edge(page)).toHaveCSS('cursor', 'col-resize');
  await drag(page, 360);
  await expect.poll(() => width(page)).toBe(360);
  await expect(edge(page)).toHaveAttribute('data-resizing', 'false');
  const after = await saved(page);
  expect(after.local.sidebarWidth).toBe(360);
  expect(after.project).toEqual(before.project);
  await expect(page.locator('#undo-button')).toBeDisabled();
  await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
  await page.locator('#workspace-toggle').click();
  await expect.poll(() => width(page)).toBe(360);
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await expect.poll(() => width(page)).toBe(360);
  await saved(page); await page.reload();
  await expect.poll(() => width(page)).toBe(360);
  await edge(page).dblclick();
  await expect.poll(() => width(page)).toBe(168);
  expect((await saved(page)).local.sidebarWidth).toBeUndefined();
  await page.reload(); await expect.poll(() => width(page)).toBe(168);
});

test('focused edge supports keyboard resizing, bounds and cancelling a captured drag', async ({ page }) => {
  await seed(page);
  await edge(page).focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(() => width(page)).toBe(178);
  await page.keyboard.press('Shift+ArrowRight'); await expect.poll(() => width(page)).toBe(218);
  await page.keyboard.press('ArrowLeft'); await expect.poll(() => width(page)).toBe(208);
  await drag(page, 460, false);
  await expect(edge(page)).toHaveAttribute('data-resizing', 'true');
  await expect(page.locator('#canvas')).toHaveCSS('cursor', 'col-resize');
  await page.screenshot({ path: 'artifacts/sidebar-resize-keyboard-drag.png' });
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect.poll(() => width(page)).toBe(208);
  await expect(edge(page)).toHaveAttribute('data-resizing', 'false');
  await expect(page.locator('#canvas')).not.toHaveCSS('cursor', 'col-resize');
  expect((await saved(page)).local.sidebarWidth).toBe(208);
  await page.keyboard.press('End'); await expect.poll(() => width(page)).toBe(1408);
  await page.keyboard.press('ArrowRight'); await expect.poll(() => width(page)).toBe(1408);
  await page.keyboard.press('Home'); await expect.poll(() => width(page)).toBe(168);
  await page.keyboard.press('ArrowLeft'); await expect.poll(() => width(page)).toBe(168);
  await expect(edge(page)).toHaveAttribute('aria-valuenow', '168');
});

test('pointer cancellation restores the saved width and releases the drag', async ({ page }) => {
  await seed(page, { sidebarWidth: 300 });
  await edge(page).evaluate(node => node.addEventListener('pointerdown', event => node.setAttribute('data-test-pointer', String((event as PointerEvent).pointerId)), { once: true }));
  await drag(page, 480, false);
  await edge(page).evaluate(node => node.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: Number(node.getAttribute('data-test-pointer')) })));
  await page.mouse.up();
  await expect.poll(() => width(page)).toBe(300);
  await expect(edge(page)).toHaveAttribute('data-resizing', 'false');
  expect((await saved(page)).local.sidebarWidth).toBe(300);
});

for (const theme of ['light', 'dark']) for (const size of ['small', 'medium', 'large']) {
  test(`saved width stays within the viewport with ${size} controls in ${theme}`, async ({ page }) => {
    await seed(page, { theme, iconTextSize: size, sidebarWidth: 1000 });
    await expect.poll(() => width(page)).toBe(1000);
    await page.setViewportSize({ width: 820, height: 900 });
    await expect.poll(() => width(page)).toBe(788);
    await page.setViewportSize({ width: 320, height: 812 });
    await expect.poll(() => width(page)).toBe(296);
    if (size === 'medium') {
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.screenshot({ path: `artifacts/sidebar-resize-mobile-${theme}.png` });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
    await page.locator('#workspace-toggle').click();
    await expect.poll(() => width(page)).toBe(296);
    expect((await saved(page)).local.sidebarWidth).toBe(1000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => width(page)).toBe(1000);
    await drag(page, 360);
    await page.screenshot({ path: `artifacts/sidebar-resize-${size}-${theme}.png` });
    await edge(page).dblclick();
    await expect.poll(() => width(page)).toBe(size === 'small' ? 126 : 168);
  });
}

test('fit to view keeps a wide drawing clear of the resized sidebar and properties', async ({ page }) => {
  await seed(page, { sidebarWidth: 400 });
  await page.locator('[data-layer-select="e:wide"] > svg').click();
  await expect(page.locator('#properties')).toBeVisible();
  await page.locator('#fit-button').click();
  const scene = await saved(page), element = scene.elements[0];
  const sidebar = (await page.locator('#workspace').boundingBox())!;
  const properties = (await page.locator('#properties').boundingBox())!;
  expect(element.x * scene.local.zoom + scene.local.pan.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width - 1);
  expect((element.x + element.width) * scene.local.zoom + scene.local.pan.x).toBeLessThanOrEqual(properties.x);
});
