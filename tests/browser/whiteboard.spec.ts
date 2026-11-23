import { test, expect, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { seedStorage, waitForInitialSave } from './storage';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const captured: string[] = []; errors.set(page, captured);
  page.on('pageerror', error => captured.push(error.message));
  page.on('console', message => { if (message.type() === 'error') captured.push(message.text()); });
  await page.goto('/'); await expect(page.locator('#canvas')).toBeVisible();
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
const scene = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1') || '{"elements":[]}'));
async function saved(page: Page) { await expect(page.locator('#save-state')).toHaveText('Saved on this device'); return scene(page); }
async function draw(page: Page, tool = 'Rectangle', x = 500, y = 280) {
  await page.getByRole('button', { name: tool, exact: true }).click();
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 160, y + 100, { steps: 5 }); await page.mouse.up();
}
test('drawing, movement, undo, redo, duplication and reload retain geometry and seeds', async ({ page }) => {
  await draw(page); const first = (await saved(page)).elements[0];
  await page.mouse.move(560, 330); await page.mouse.down(); await page.mouse.move(590, 350); await page.mouse.up();
  expect((await saved(page)).elements[0]).toMatchObject({ x: first.x + 30, y: first.y + 20, seed: first.seed });
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await saved(page)).elements[0].x).toBe(first.x);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.mouse.click(first.x + 30, first.y + 70);
  await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+d');
  const savedScene = await saved(page); expect(savedScene.elements).toHaveLength(2); expect(savedScene.elements[1].seed).toBe(first.seed);
  await page.reload(); await expect(page.locator('#selection-info')).toHaveText('2 elements'); expect((await scene(page)).elements).toEqual(savedScene.elements);
});
test('selected shape sides resize at and away from the midpoint', async ({ page }) => {
  await draw(page);
  const original = (await saved(page)).elements[0];
  const canvas = page.locator('#canvas');
  await page.mouse.move(665, 330);
  await expect(canvas).toHaveCSS('cursor', 'e-resize');
  await page.mouse.down(); await page.mouse.move(705, 350); await page.mouse.up();
  expect((await saved(page)).elements[0]).toMatchObject({ width: 200, height: 100 });
  await page.mouse.move(540, 275);
  await expect(canvas).toHaveCSS('cursor', 'n-resize');
  await page.mouse.down(); await page.mouse.move(565, 245); await page.mouse.up();
  expect((await saved(page)).elements[0]).toMatchObject({ x: original.x, y: original.y - 30, width: 200, height: 130 });
  await page.reload();
  expect((await scene(page)).elements[0]).toMatchObject({ width: 200, height: 130 });
});
test('all drawing tools and keyboard insertion work', async ({ page }) => {
  for (const tool of ['Rectangle', 'Diamond', 'Ellipse', 'Arrow', 'Line', 'Draw']) {
    await page.getByRole('button', { name: tool, exact: true }).click(); await page.locator('#canvas').focus(); await page.keyboard.press('Enter');
  }
  expect((await saved(page)).elements.map((e: { type: string }) => e.type)).toEqual(['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw']);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete'); expect((await saved(page)).elements).toHaveLength(0);
});
test('rich text retains native focus, formatting, links, cancellation and exports', async ({ page }) => {
  await page.getByRole('button', { name: 'Text', exact: true }).click(); await page.mouse.click(450, 300);
  const editor = page.getByRole('textbox', { name: 'Edit canvas text' }); await expect(editor).toBeFocused();
  await page.keyboard.type('Sketch link'); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('ControlOrMeta+b'); await page.keyboard.press('ControlOrMeta+i'); await page.keyboard.press('ControlOrMeta+u');
  await page.keyboard.press('ControlOrMeta+k'); await page.getByLabel('Link address').fill('https://example.com/'); await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(editor).toBeFocused(); await page.getByRole('button', { name: 'Done', exact: true }).click();
  const element = (await saved(page)).elements[0]; expect(element.textSpans[0]).toMatchObject({ bold: true, italic: true, underline: true, link: 'https://example.com/' });
  await page.mouse.dblclick(470, 315); await expect(editor).toBeFocused(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type('Cancelled'); await page.keyboard.press('Escape');
  expect((await saved(page)).elements[0]).toEqual(element);
  await page.getByRole('button', { name: 'Main menu', exact: true }).click(); await page.getByRole('button', { name: 'Export image', exact: true }).click();
  const download = page.waitForEvent('download'); await page.locator('[data-export="svg"]').click(); expect((await download).suggestedFilename()).toMatch(/^sketchify_\d{4}-\d{2}-\d{2}\.svg$/);
});
test('single-click text selection supports whole-object formatting, links and canvas history', async ({ page }) => {
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.mouse.click(450, 300);
  await page.keyboard.type('Sketch link');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.mouse.click(400, 260);
  const toolbar = page.getByRole('toolbar', { name: 'Format selected text' });
  await expect(toolbar).toBeHidden();
  await page.mouse.click(470, 315);
  await expect(toolbar).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Edit canvas text' });
  await expect(editor).toBeHidden();
  await toolbar.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.press('ControlOrMeta+i');
  await toolbar.getByRole('button', { name: 'Underline' }).click();
  await page.keyboard.press('ControlOrMeta+k');
  const address = page.getByLabel('Link address');
  await expect(address).toBeFocused();
  await address.fill('https://example.com/');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(editor).toBeHidden();
  const marks = { start: 0, end: 11, bold: true, italic: true, underline: true };
  expect((await saved(page)).elements[0].textSpans).toEqual([{ ...marks, link: 'https://example.com/' }]);
  await page.keyboard.press('ControlOrMeta+z');
  expect((await saved(page)).elements[0].textSpans).toEqual([marks]);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await saved(page);
  await page.reload();
  expect((await saved(page)).elements[0].textSpans).toEqual([{ ...marks, link: 'https://example.com/' }]);
  await page.mouse.click(470, 315);
  await expect(toolbar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  await toolbar.getByRole('button', { name: 'Add or edit link' }).click();
  await expect(address).toHaveValue('https://example.com/');
  await page.mouse.click(400, 260);
  await page.mouse.click(470, 315);
  await expect(address).toBeHidden();
});
for (const family of ['Patrick Hand', 'Excalifont']) test(`${family} loads locally and survives reload, standalone SVG and PNG exports`, async ({ page }) => {
  const excalifont = family === 'Excalifont';
  const handwriting = /^(?:"Patrick Hand"|Patrick Hand), cursive$/;
  await expect.poll(() => page.evaluate(family => [...document.fonts].some(font => font.family.replace(/["']/g, '') === family && font.status === 'loaded'), family)).toBe(true);
  await expect(page.locator('.welcome h1')).toHaveCSS('font-family', handwriting);
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Excalifont', exact: true })).toHaveAttribute('aria-pressed', 'true');
  if (!excalifont) await page.getByRole('button', { name: 'Hand drawn', exact: true }).click();
  await page.mouse.click(450, 300);
  await expect(page.locator('#text-editor')).toHaveCSS('font-family', excalifont ? 'Excalifont, cursive' : handwriting);
  await page.keyboard.type('Sketching gyp 123'); await page.getByRole('button', { name: 'Done', exact: true }).click();
  const element = (await saved(page)).elements[0];
  expect(element.fontFamily).toBe(excalifont ? 5 : 1);
  const font = `${element.fontSize}px "${family}"`;
  const measured = await page.evaluate(font => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = font; return ctx.measureText('Sketching gyp 123').width;
  }, font);
  expect(element.width).toBeCloseTo(measured, 3);
  await page.reload(); await saved(page); expect((await scene(page)).elements[0].fontFamily).toBe(element.fontFamily);
  await page.getByRole('button', { name: 'Main menu', exact: true }).click(); await page.getByRole('button', { name: 'Export image', exact: true }).click();
  const svgDownload = page.waitForEvent('download'); await page.locator('[data-export="svg"]').click();
  const svg = await readFile((await (await svgDownload).path())!, 'utf8');
  expect(svg).toContain(`data:font/${excalifont ? 'woff2' : 'ttf'};base64,`); expect(svg).toContain('SIL OPEN FONT LICENSE');
  expect(svg).toContain(`font-family="${family},cursive"`);
  if (excalifont) expect(svg.match(/@font-face/g)).toHaveLength(7);
  const pngDownload = page.waitForEvent('download'); await page.locator('[data-export="png"]').click();
  const png = await loadImage(await readFile((await (await pngDownload).path())!));
  expect(png.width).toBe(Math.ceil((element.width + 48) * 2));
  // Open the exported file with no app stylesheet or local font installed.
  await page.goto(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  const exported = await page.evaluate(async ({ family, font }) => {
    await document.fonts.load(font);
    const label = document.querySelector('text')!;
    return { width: label.getComputedTextLength(), loaded: [...document.fonts].some(font => font.family.replace(/["']/g, '') === family && font.status === 'loaded') };
  }, { family, font });
  expect(exported.loaded).toBe(true);
  // Chromium on Linux rounds glyph advances differently in standalone SVG and canvas.
  expect(Math.abs(exported.width - measured)).toBeLessThanOrEqual(3);
});
test('text width wraps without changing font size and stays wrapped when editing and reloading', async ({ page }) => {
  await page.getByRole('button', { name: 'Text', exact: true }).click(); await page.mouse.click(450, 250);
  const editor = page.locator('#text-editor');
  await page.keyboard.type('Sketch ideas on canvas'); await page.getByRole('button', { name: 'Done', exact: true }).click();
  const original = (await saved(page)).elements[0];
  await page.mouse.move(original.x + original.width, original.y + original.height / 2);
  await page.mouse.down(); await page.mouse.move(original.x + 180, original.y + original.height / 2, { steps: 5 }); await page.mouse.up();
  const wrapped = (await saved(page)).elements[0];
  expect(wrapped.textWidth).toBe(180); expect(wrapped.fontSize).toBe(original.fontSize); expect(wrapped.height).toBeGreaterThan(original.height);
  await page.reload(); await saved(page); await page.mouse.dblclick(wrapped.x + 20, wrapped.y + 15);
  await expect(editor).toBeFocused(); await expect(editor).toHaveCSS('white-space', 'pre-wrap');
  expect(await editor.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await saved(page)).elements[0]).toEqual(wrapped);
  await expect(page.getByRole('spinbutton', { name: 'Text box width in pixels' })).toHaveCount(0);
});
for (const [fontFamily, zoom] of [[1, 1], [2, 2], [3, .75], [5, 1.5]]) test(`text stays in place when editing font ${fontFamily} at zoom ${zoom}`, async ({ page }) => {
  await seedStorage(page, {
    elements: [{ id: 'label', type: 'text', x: 300, y: 240, fontSize: 48, fontFamily, text: 'Align\nAgain' }],
    local: { zoom, pan: { x: 100, y: -80 } },
  });
  await page.reload(); await waitForInitialSave(page);
  await page.evaluate(async () => { await document.fonts.ready; });
  const original = (await saved(page)).elements[0];
  const x = original.x * zoom + 100, y = original.y * zoom - 80;
  const fontHeight = original.fontSize * zoom, lineHeight = fontHeight * 1.25;
  const clip = { x: x - 12, y: y - 12, width: Math.ceil(original.width * zoom) + 24, height: Math.ceil(lineHeight * 2) + 24 };
  const lineSplit = Math.round(12 + (fontHeight + lineHeight) / 2);
  async function inkBounds() {
    const image = await loadImage(await page.screenshot({ clip, caret: 'hide', scale: 'css' }));
    const canvas = createCanvas(image.width, image.height), ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    return [[0, lineSplit], [lineSplit, image.height]].map(([start, end]) => {
      let left = image.width, top = image.height, right = -1, bottom = -1;
      for (let py = start; py < end; py++) for (let px = 0; px < image.width; px++) {
        const index = (py * image.width + px) * 4, colors = [pixels[index], pixels[index + 1], pixels[index + 2]];
        if (Math.max(...colors) < 180 && Math.max(...colors) - Math.min(...colors) < 15) {
          left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
        }
      }
      expect(right).toBeGreaterThan(left); return [left, top, right, bottom];
    });
  }
  const before = await inkBounds();
  await page.mouse.dblclick(x + 12, y + 20 * zoom);
  await expect(page.locator('#text-editor')).toBeFocused(); await page.keyboard.press('ArrowRight');
  const geometry = await page.locator('#text-editor').evaluate((editor: HTMLElement) => {
    return { top: Number.parseFloat(editor.style.top), height: Number.parseFloat(editor.style.getPropertyValue('--text-content-height')) };
  });
  expect(Math.abs(geometry.top - y)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.height - original.height * zoom)).toBeLessThanOrEqual(1);
  const during = await inkBounds();
  for (let line = 0; line < before.length; line++) for (let edge = 0; edge < 4; edge++) expect(Math.abs(during[line][edge] - before[line][edge])).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await saved(page)).elements[0]).toEqual(original);
});
test('file input and drag/drop report skipped elements and preserve undo', async ({ page }) => {
  await draw(page); const before = (await saved(page)).elements;
  const payload = { elements: [{ type: 'rectangle', id: 'imported', x: 200, y: 200, width: 120, height: 80, seed: 17 }, { type: 'image' }] };
  await page.locator('#open-file').setInputFiles({ name: 'Imported.excalidraw', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
  await expect(page.getByRole('dialog')).toContainText('1 unsupported element'); await page.getByRole('button', { name: 'Import supported elements' }).click();
  expect((await saved(page)).elements[0].id).toBe('imported');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await saved(page)).elements).toEqual(before);
  await page.evaluate(() => { const data = new DataTransfer(); data.items.add(new File(['{"elements":[]}'], 'Empty.json', { type: 'application/json' })); document.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })); });
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0);
});
test('mobile styles, themes, focus return and reduced motion remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 }); await page.reload();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click(); await expect(page.locator('#properties')).toBeHidden();
  await page.getByRole('button', { name: 'Toggle style panel' }).click(); await expect(page.locator('#properties')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Corner rounding in pixels' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rounded corners' }).click();
  const rounding = page.getByRole('spinbutton', { name: 'Corner rounding in pixels' });
  await expect(rounding).toHaveValue('32');
  await rounding.fill('45'); await rounding.press('Enter'); await page.locator('#canvas').focus(); await page.keyboard.press('Enter');
  expect((await saved(page)).elements[0].roundness).toEqual({ type: 3, value: 45 });
  await page.getByRole('button', { name: 'Main menu', exact: true }).click(); await page.getByRole('button', { name: 'Dark', exact: true }).click(); await expect(page.locator('html')).toHaveClass('dark');
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Main menu', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Help and keyboard shortcuts' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Help and keyboard shortcuts' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' }); expect(await page.locator('#menu-button').evaluate(button => getComputedStyle(button).transitionDuration)).toBe('0s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/next-mobile.png' });
});
test('corner rounding synchronizes the slider and number field, undo and saved defaults', async ({ page }) => {
  await draw(page);
  const slider = page.getByRole('slider', { name: 'Corner rounding', exact: true });
  const number = page.getByRole('spinbutton', { name: 'Corner rounding in pixels' });
  await expect(slider).toHaveCount(0); await expect(number).toHaveCount(0);
  await page.getByRole('button', { name: 'Rounded corners' }).click();
  await expect(slider).toHaveValue('32'); await expect(number).toHaveValue('32');
  const before = await page.locator('#canvas').screenshot();
  await number.fill('18'); await expect(slider).toHaveValue('18'); await number.press('Enter');
  expect((await saved(page)).elements[0].roundness).toEqual({ type: 3, value: 18 });
  expect(await page.locator('#canvas').screenshot()).not.toEqual(before);
  await slider.focus(); await slider.press('ArrowRight'); await expect(number).toHaveValue('19');
  expect((await saved(page)).elements[0].roundness).toEqual({ type: 3, value: 19 });
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + 10 + (box.width - 20) * .19, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2, { steps: 8 });
  await expect(number).toHaveValue('100'); await page.mouse.up();
  expect((await saved(page)).elements[0].roundness).toEqual({ type: 3, value: 100 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).elements[0].roundness).toEqual({ type: 3, value: 19 });
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.reload(); await saved(page);
  await draw(page, 'Rectangle', 750, 280);
  expect((await saved(page)).elements[1].roundness).toEqual({ type: 3, value: 100 });
  await number.fill('999'); await number.press('Enter'); await expect(number).toHaveValue('100');
  await number.fill(''); await number.press('Enter'); await expect(number).toHaveValue('100');
  await number.fill('-5'); await number.press('Enter'); await expect(slider).toHaveValue('0');
  expect((await saved(page)).elements[1].roundness).toEqual({ type: 3, value: 0 });
  await page.getByRole('button', { name: 'Sharp corners' }).click();
  await expect(slider).toHaveCount(0); await expect(number).toHaveCount(0);
  expect((await saved(page)).elements[1].roundness).toBeNull();
  await page.getByRole('button', { name: 'Rounded corners' }).click();
  await expect(number).toHaveValue('32');
  await page.screenshot({ path: 'artifacts/corner-rounding-desktop.png' });
});
test('production drawing interactions make no external requests', async ({ page }) => {
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await draw(page); await saved(page);
  await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+d'); await saved(page);
  expect(requests.filter(url => !url.startsWith('http://127.0.0.1:3000/') && !url.startsWith('blob:') && !url.startsWith('data:'))).toEqual([]);
  await page.screenshot({ path: 'artifacts/next-desktop.png' });
});
test('library removal preserves saved drawings and clipboard reuse on desktop and mobile', async ({ page }) => {
  await seedStorage(page, { elements: [{ id: 'existing', type: 'rectangle', x: 500, y: 280, width: 160, height: 100, seed: 17 }] }, {
    'sketchify.library.v1': '{invalid legacy data',
  });
  await page.reload(); await waitForInitialSave(page);
  const original = (await saved(page)).elements[0];
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 }); await page.reload(); await saved(page);
    await expect(page.getByRole('button', { name: /library/i })).toHaveCount(0);
    await expect(page.locator('#library')).toHaveCount(0);
    await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+a');
    if (width === 375) await page.getByRole('button', { name: 'Toggle style panel' }).click();
    await expect(page.getByRole('button', { name: 'Duplicate selection', exact: true })).toBeVisible();
    await page.locator('#canvas').focus();
    await page.evaluate(() => {
      const data = new DataTransfer();
      for (const type of ['copy', 'paste']) {
        const event = new ClipboardEvent(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', { value: data });
        document.dispatchEvent(event);
      }
    });
    const copies = (await saved(page)).elements;
    expect(copies).toHaveLength(2); expect(copies[1].seed).toBe(original.seed); expect(copies[1].id).not.toBe(original.id);
    await page.keyboard.press('ControlOrMeta+z'); expect((await saved(page)).elements).toEqual([original]);
    await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: /library/i })).toHaveCount(0);
    await expect(page.locator('[data-context-action="copy"]')).toBeEnabled();
    await page.keyboard.press('Escape'); await expect(page.locator('#canvas')).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('sketchify.library.v1'))).toBe('{invalid legacy data');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
