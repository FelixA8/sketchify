import { test, expect, type Page } from '@playwright/test';

const saved = async (page: Page) => {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements);
};

for (const mobile of [false, true]) test(`double-click shape labels wrap, re-edit and survive reload on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const x = mobile ? 40 : 400, y = mobile ? 220 : 240, width = mobile ? 300 : 480;
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + width, y + 220); await page.mouse.up();
  await page.mouse.dblclick(x + width / 2, y);
  const editor = page.getByRole('textbox', { name: 'Edit canvas text' }); await expect(editor).toBeFocused();
  await page.keyboard.type('Blender MCP + Claude/Codex');
  if (!mobile) await page.getByRole('button', { name: 'Extra large', exact: true }).click();
  await expect(editor).toHaveCSS('text-align', 'center');
  const box = (await editor.boundingBox())!;
  expect(box.x).toBeGreaterThan(x); expect(box.x + box.width).toBeLessThanOrEqual(x + width);
  expect(box.y).toBeGreaterThan(y); expect(box.y + box.height).toBeLessThan(y + 220);
  await page.screenshot({ path: `artifacts/shape-text-${mobile ? 'mobile' : 'desktop'}.png` });
  await page.keyboard.press('ControlOrMeta+Enter');
  const elements = await saved(page); expect(elements).toHaveLength(2);
  const label = elements[1]; expect(label.containerId).toBe(elements[0].id);
  expect(label.x + label.width / 2).toBeCloseTo(x + width / 2);
  expect(label.y + label.height / 2).toBeCloseTo(y + 110);
  await page.reload(); await saved(page);
  await page.mouse.dblclick(x + width / 2, y + 110); await expect(editor).toBeFocused();
  await expect(editor).toHaveText(label.text);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type('Cancelled'); await page.keyboard.press('Escape');
  expect(await saved(page)).toEqual(elements); expect(errors).toEqual([]);
});

for (const mobile of [false, true]) for (const tool of ['Rectangle', 'Ellipse', 'Diamond']) {
  test(`${tool}: T creates separate text and only border double-clicks bind on ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const x = mobile ? 40 : 400, y = mobile ? 220 : 240, width = 300, height = 200;
    await page.evaluate(({ tool, x, y, width, height, mobile }) => {
      localStorage.setItem('sketchify.scene.v1', JSON.stringify({
        elements: [{ id: 'shape', type: tool.toLowerCase(), x, y, width, height, backgroundColor: mobile ? '#ffc9c9' : 'transparent' }],
        local: { theme: mobile ? 'dark' : 'light' },
      }));
    }, { tool, x, y, width, height, mobile });
    await page.reload(); const original = (await saved(page))[0];
    const editor = page.getByRole('textbox', { name: 'Edit canvas text' });
    await page.locator('#canvas').focus(); await page.keyboard.press('t');
    await page.mouse.click(x + 80, y + height / 2); await expect(editor).toBeFocused();
    await page.keyboard.type('Separate'); await page.keyboard.press('ControlOrMeta+Enter');
    let elements = await saved(page);
    expect(elements).toHaveLength(2); expect(elements[0]).toEqual(original); expect(elements[1].containerId).toBeFalsy();

    await page.mouse.dblclick(x + width / 2, y + 45); await expect(editor).toBeFocused();
    await page.keyboard.type('Interior'); await page.keyboard.press('ControlOrMeta+Enter');
    elements = await saved(page); expect(elements).toHaveLength(3); expect(elements[2].containerId).toBeFalsy();

    await page.mouse.dblclick(x + width / 2, y); await expect(editor).toBeFocused();
    await expect(editor).toHaveCSS('text-align', 'center');
    await page.keyboard.type('Attached'); await page.keyboard.press('ControlOrMeta+Enter');
    elements = await saved(page); expect(elements).toHaveLength(4); expect(elements[3].containerId).toBe(original.id);
    const attached = elements[3];
    await page.keyboard.press('t'); await page.mouse.click(attached.x + 10, attached.y + 10);
    await expect(editor).toBeFocused(); await expect(editor).toBeEmpty();
    await page.keyboard.type('Over text'); await page.keyboard.press('ControlOrMeta+Enter');
    elements = await saved(page); expect(elements).toHaveLength(5); expect(elements[3]).toEqual(attached); expect(elements[4].containerId).toBeFalsy();

    await page.keyboard.press('Escape');
    await page.mouse.move(x + width, y + height / 2); await page.mouse.down();
    await page.mouse.move(x + width + 20, y + height / 2 + 10); await page.mouse.up();
    const moved = await saved(page);
    expect(moved[0].x).toBe(original.x + 20); expect(moved[0].y).toBe(original.y + 10);
    expect(moved[3].x).toBeCloseTo(attached.x + 20); expect(moved[3].y).toBeCloseTo(attached.y + 10);
    for (const index of [1, 2, 4]) expect(moved[index]).toEqual(elements[index]);
    await page.keyboard.press('Delete'); expect(await saved(page)).toEqual([elements[1], elements[2], elements[4]]);
    await page.keyboard.press('ControlOrMeta+z'); expect(await saved(page)).toEqual(moved);
    await page.reload(); expect(await saved(page)).toEqual(moved);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
