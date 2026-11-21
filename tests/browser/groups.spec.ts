import { test, expect, type Page } from '@playwright/test';

async function seed(page: Page, theme = 'light', mobile = false) {
  await page.goto('/');
  await page.evaluate(({ theme, mobile }) => localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [
    { id: 'one', type: 'rectangle', x: mobile ? 50 : 400, y: 250, width: mobile ? 80 : 120, height: 80 },
    { id: 'two', type: 'ellipse', x: mobile ? 220 : 700, y: 250, width: mobile ? 80 : 120, height: 80 },
  ], local: { theme } })), { theme, mobile });
  await page.reload(); await expect(page.locator('#canvas')).toBeVisible();
}
async function scene(page: Page) {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements);
}

test('group shortcuts, member selection, transforms, nested ungroup and undo work in the browser', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await seed(page); await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+g');
  const grouped = await scene(page); expect(grouped[0].groupIds).toHaveLength(1); expect(grouped[1].groupIds).toEqual(grouped[0].groupIds);
  await page.keyboard.press('Escape'); await page.mouse.click(400, 290);
  await expect(page.locator('#selection-info')).toHaveText('2 selected');
  await page.keyboard.press('ArrowRight'); expect((await scene(page)).map((element: { x: number }) => element.x)).toEqual([401, 701]);
  await page.mouse.dblclick(401, 290); await expect(page.locator('#selection-info')).toHaveText('1 selected');
  await page.keyboard.press('ArrowRight'); expect((await scene(page)).map((element: { x: number }) => element.x)).toEqual([402, 701]);
  await page.keyboard.press('Escape'); await expect(page.locator('#selection-info')).toHaveText('2 selected');
  await page.mouse.move(402, 290); await page.mouse.down(); await page.mouse.move(422, 310, { steps: 3 }); await page.mouse.up();
  expect((await scene(page)).map((element: { x: number }) => element.x)).toEqual([422, 721]);
  await page.keyboard.press('ControlOrMeta+d');
  const duplicated = (await scene(page)).slice(2); expect(duplicated[0].groupIds).not.toEqual(grouped[0].groupIds); expect(duplicated[0].groupIds).toEqual(duplicated[1].groupIds);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('ControlOrMeta+g');
  expect((await scene(page))[0].groupIds).toHaveLength(2);
  await page.keyboard.press('ControlOrMeta+Shift+g'); expect((await scene(page))[0].groupIds).toHaveLength(1);
  await page.keyboard.press('ControlOrMeta+z'); expect((await scene(page))[0].groupIds).toHaveLength(2);
  await page.reload(); await page.mouse.click(422, 310); await expect(page.locator('#selection-info')).toHaveText('4 selected');
  expect(errors).toEqual([]);
});

for (const theme of ['light', 'dark']) for (const width of [1280, 375]) test(`group menu works in ${theme} theme at ${width}px`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 800 }); await seed(page, theme, width === 375);
  await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Shift+F10');
  const group = page.locator('[data-context-action="group"]'), ungroup = page.locator('[data-context-action="ungroup"]');
  await expect(group).toBeEnabled(); await expect(ungroup).toBeDisabled();
  await group.click(); expect((await scene(page))[0].groupIds).toHaveLength(1);
  await page.keyboard.press('Shift+F10'); await expect(group).toBeDisabled(); await expect(ungroup).toBeEnabled();
  await ungroup.scrollIntoViewIfNeeded(); await expect(ungroup).toBeInViewport();
  const menu = await page.locator('#object-context-menu').boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0); expect(menu!.x + menu!.width).toBeLessThanOrEqual(width); expect(menu!.y + menu!.height).toBeLessThanOrEqual(800);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: `artifacts/groups-${theme}-${width}.png` });
  await ungroup.click(); expect((await scene(page)).every((element: { groupIds: string[] }) => element.groupIds.length === 0)).toBe(true);
  expect(errors).toEqual([]);
});
