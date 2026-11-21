import { test, expect, type Page } from '@playwright/test';

const saved = async (page: Page) => {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements);
};

for (const mobile of [false, true]) {
  test(`standalone text alignment works while editing and selected on ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    if (mobile) {
      await page.evaluate(() => localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [], local: { theme: 'dark' } })));
      await page.reload();
    }
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.mouse.click(mobile ? 70 : 460, mobile ? 330 : 250);
    const editor = page.getByRole('textbox', { name: 'Edit canvas text' });
    await expect(editor).toBeFocused(); await page.keyboard.type('Longer line\nShort');
    if (mobile) await page.locator('#style-toggle').click();
    await expect(page.getByRole('group', { name: 'Vertical text alignment' })).toHaveCount(0);
    for (const value of ['left', 'center', 'right']) {
      const button = page.getByRole('button', { name: `Align text ${value}`, exact: true });
      await button.click(); await expect(editor).toBeFocused(); await expect(editor).toHaveCSS('text-align', value);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      if (mobile) { const box = (await button.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    }
    await page.screenshot({ path: `artifacts/text-align-${mobile ? 'mobile-dark' : 'desktop-light'}.png` });
    await page.keyboard.press('ControlOrMeta+Enter'); let elements = await saved(page);
    expect(elements[0].textAlign).toBe('right');
    const center = page.getByRole('button', { name: 'Align text center', exact: true });
    await center.focus(); await page.keyboard.press('Space');
    elements = await saved(page); expect(elements[0].textAlign).toBe('center');
    await page.reload(); expect(await saved(page)).toEqual(elements);
    await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Enter');
    await expect(editor).toHaveCSS('text-align', 'center'); await expect(editor).toHaveText('Longer line\nShort');
    await page.keyboard.press('Escape'); expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`rectangle supports all nine alignments and retains them when reopened on ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const x = mobile ? 40 : 460, y = mobile ? 220 : 240, width = 300, height = 240;
    await page.evaluate(({ x, y, width, height, mobile }) => {
      localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [{ id: 'rectangle', type: 'rectangle', x, y, width, height }], local: { theme: mobile ? 'dark' : 'light' } }));
    }, { x, y, width, height, mobile }); await page.reload();
    await page.mouse.dblclick(x + width / 2, y);
    const editor = page.getByRole('textbox', { name: 'Edit canvas text' });
    await expect(editor).toBeFocused(); await page.keyboard.type('Longer line\nShort');
    if (mobile) await page.locator('#style-toggle').click();
    await expect(page.getByRole('button', { name: 'Align text center', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Align text middle', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ControlOrMeta+Enter');
    for (const horizontal of ['left', 'center', 'right']) for (const vertical of ['top', 'middle', 'bottom']) {
      await page.getByRole('button', { name: `Align text ${horizontal}`, exact: true }).click();
      await page.getByRole('button', { name: `Align text ${vertical}`, exact: true }).click();
      const [parent, text] = await saved(page);
      expect(text.textAlign).toBe(horizontal); expect(text.verticalAlign).toBe(vertical);
      expect(text.x).toBeCloseTo(parent.x + 16); expect(text.width).toBeCloseTo(parent.width - 32);
      const expectedY = vertical === 'top' ? parent.y + 16 : vertical === 'bottom' ? parent.y + parent.height - 16 - text.height : parent.y + (parent.height - text.height) / 2;
      expect(text.y).toBeCloseTo(expectedY);
    }
    await page.locator('#canvas').focus(); await page.keyboard.press('Enter');
    await expect(editor).toHaveCSS('text-align', 'right');
    await expect(page.getByRole('button', { name: 'Align text bottom', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `artifacts/rectangle-align-${mobile ? 'mobile-dark' : 'desktop-light'}.png` });
    await page.getByRole('button', { name: 'Align text left', exact: true }).click();
    await page.getByRole('button', { name: 'Align text top', exact: true }).click();
    await expect(editor).toBeFocused(); await expect(editor).toHaveCSS('text-align', 'left');
    await page.keyboard.press('Escape'); const before = await saved(page);
    expect(before[1].textAlign).toBe('right'); expect(before[1].verticalAlign).toBe('bottom');
    await page.reload(); expect(await saved(page)).toEqual(before);
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
