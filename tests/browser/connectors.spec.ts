import { test, expect, type Page } from '@playwright/test';

const saved = async (page: Page) => {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements);
};
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up();
}

for (const mobile of [false, true]) for (const theme of ['light', 'dark']) test(`arrow type controls on ${mobile ? 'mobile' : 'desktop'} in ${theme}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
  await page.addInitScript(theme => {
    if (!localStorage.getItem('sketchify.scene.v1')) localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [], local: { theme } }));
  }, theme);
  await page.goto('/');
  await page.locator('[data-tool="arrow"]').click();
  if (mobile) await page.locator('#style-toggle').click();
  const types = page.getByRole('group', { name: 'Arrow type' });
  const straight = types.getByRole('button', { name: 'Straight', exact: true });
  const curved = types.getByRole('button', { name: 'Curved', exact: true });
  const rightAngle = types.getByRole('button', { name: 'Right angle', exact: true });
  await expect(straight).toHaveAttribute('aria-pressed', 'true');
  await curved.focus();
  await page.keyboard.press('Space');
  await expect(curved).toHaveAttribute('aria-pressed', 'true');
  if (mobile) {
    const box = (await curved.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const x = mobile ? 22 : 400, width = mobile ? 110 : 200;
  await drag(page, { x, y: 420 }, { x: x + width, y: 510 });
  expect((await saved(page))[0]).toMatchObject({ arrowType: 'curved', roundness: { type: 2 } });
  await rightAngle.click();
  await expect(rightAngle).toHaveAttribute('aria-pressed', 'true');
  const right = (await saved(page))[0];
  expect(right.points).toEqual([[0, 0], [width / 2, 0], [width / 2, 90], [width, 90]]);
  await page.screenshot({ path: `artifacts/arrow-type-${mobile ? 'mobile' : 'desktop'}-${theme}-${test.info().project.name}.png` });
  const middle = { x: x + width / 2, y: 465 };
  await drag(page, middle, { x: middle.x + 24, y: middle.y + 12 });
  const rerouted = (await saved(page))[0];
  expect(rerouted).toMatchObject({ x, y: 420, points: [[0, 0], [width / 2 + 24, 0], [width / 2 + 24, 90], [width, 90]] });
  await page.screenshot({ path: `artifacts/arrow-elbow-${mobile ? 'mobile' : 'desktop'}-${theme}-${test.info().project.name}.png` });
  await page.locator('#undo-button').click();
  expect((await saved(page))[0]).toEqual(right);
  await page.locator('#undo-button').click();
  expect((await saved(page))[0].arrowType).toBe('curved');
  await page.locator('#redo-button').click();
  expect((await saved(page))[0]).toEqual(right);
  await page.locator('#redo-button').click();
  expect((await saved(page))[0]).toEqual(rerouted);
  await page.reload();
  expect((await saved(page))[0]).toEqual(rerouted);
  await page.locator('[data-tool="arrow"]').click();
  if (mobile) await page.locator('#style-toggle').click();
  await expect(curved).toHaveAttribute('aria-pressed', 'true');
});

for (const mobile of [false, true]) for (const theme of ['light', 'dark']) test(`an arrow midpoint creates an editable bend on ${mobile ? 'mobile' : 'desktop'} in ${theme}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
  await page.goto('/');
  if (theme === 'dark') {
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.keyboard.press('Escape');
  }
  const tail = { x: mobile ? 80 : 460, y: 480 };
  const head = { x: tail.x + 200, y: 280 };
  const middle = { x: tail.x + 100, y: 380 };
  const canvas = page.locator('#canvas');
  const pixels = () => canvas.evaluate((node: HTMLCanvasElement, points) => points.map(({ x, y }) =>
    Array.from(node.getContext('2d')!.getImageData(x * devicePixelRatio, y * devicePixelRatio, 1, 1).data)),
  [tail, middle, head, { x: middle.x, y: head.y - 5 }, { x: middle.x, y: head.y - 32 }]);
  await page.locator('[data-tool="arrow"]').click();
  await drag(page, tail, head);
  const original = (await saved(page))[0];
  await page.mouse.move(middle.x, middle.y);
  await expect(canvas).toHaveCSS('cursor', 'crosshair');
  const selected = await pixels();
  await page.screenshot({ path: `artifacts/arrow-handles-${mobile ? 'mobile' : 'desktop'}-${theme}-${test.info().project.name}.png` });
  await page.keyboard.press('Escape');
  await expect.poll(pixels).not.toEqual(selected);
  const deselected = await pixels();
  selected.slice(0, 3).forEach((pixel, index) => expect(pixel).not.toEqual(deselected[index]));
  expect(selected[3]).toEqual(deselected[3]);
  expect(selected[4]).not.toEqual(deselected[4]);
  await page.mouse.click(middle.x, middle.y);
  await page.mouse.click(middle.x, middle.y);
  expect((await saved(page))[0]).toEqual(original);
  const bend = { x: middle.x - 40, y: middle.y - 20 };
  await drag(page, middle, bend);
  const bent = (await saved(page))[0];
  expect(bent).toMatchObject({ x: original.x, y: original.y, points: [[0, 0], [60, -120], original.points[1]] });
  await page.screenshot({ path: `artifacts/arrow-bend-${mobile ? 'mobile' : 'desktop'}-${theme}-${test.info().project.name}.png` });
  await drag(page, bend, { x: bend.x + 20, y: bend.y + 40 });
  const adjusted = (await saved(page))[0];
  expect(adjusted.points).toEqual([[0, 0], [80, -80], original.points[1]]);
  await page.keyboard.press('ControlOrMeta+z');
  expect((await saved(page))[0]).toEqual(bent);
  await page.keyboard.press('ControlOrMeta+z');
  expect((await saved(page))[0]).toEqual(original);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  expect((await saved(page))[0]).toEqual(bent);
  await page.reload();
  expect((await saved(page))[0]).toEqual(bent);
});

for (const type of ['arrow', 'line']) test(`${type} binds two shapes, follows transforms, detaches, undoes and reloads`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto('/');
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await drag(page, { x: 350, y: 250 }, { x: 510, y: 350 });
  await page.getByRole('button', { name: 'Ellipse', exact: true }).click();
  await drag(page, { x: 750, y: 250 }, { x: 910, y: 350 });
  await page.locator(`[data-tool="${type}"]`).click();
  await drag(page, { x: 517, y: 300 }, { x: 743, y: 300 });
  let elements = await saved(page);
  expect(elements[2].startBinding.elementId).toBe(elements[0].id);
  expect(elements[2].endBinding.elementId).toBe(elements[1].id);
  const attachment = elements[2].startBinding.fixedPoint;
  await drag(page, { x: 430, y: 250 }, { x: 460, y: 290 });
  elements = await saved(page);
  expect(elements[2].x).toBeCloseTo(540); expect(elements[2].y).toBeCloseTo(340);
  expect(elements[2].startBinding.fixedPoint).toEqual(attachment);
  await drag(page, { x: 540, y: 390 }, { x: 600, y: 450 });
  elements = await saved(page);
  expect(elements[2].x).toBeCloseTo(600); expect(elements[2].y).toBeCloseTo(370);
  await page.mouse.click(675, 335);
  await drag(page, { x: 600, y: 370 }, { x: 640, y: 490 });
  elements = await saved(page); expect(elements[2].startBinding).toBeNull();
  await page.keyboard.press('ControlOrMeta+z');
  elements = await saved(page); expect(elements[2].startBinding.elementId).toBe(elements[0].id);
  await page.reload(); elements = await saved(page);
  expect(elements[2].startBinding.fixedPoint).toEqual(attachment);
  await drag(page, { x: 830, y: 250 }, { x: 850, y: 280 });
  elements = await saved(page);
  const endpoint = elements[2].points.at(-1);
  expect(elements[2].x + endpoint[0]).toBeCloseTo(770);
  expect(elements[2].y + endpoint[1]).toBeCloseTo(330);
  await page.screenshot({ path: `artifacts/connected-${type}.png` });
  expect(errors).toEqual([]);
});

test('mobile arrow snaps to a diamond and follows it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await drag(page, { x: 50, y: 200 }, { x: 190, y: 290 });
  await page.getByRole('button', { name: 'Diamond', exact: true }).click();
  await drag(page, { x: 50, y: 440 }, { x: 190, y: 530 });
  await page.locator('[data-tool="arrow"]').click();
  await drag(page, { x: 120, y: 296 }, { x: 120, y: 434 });
  let elements = await saved(page);
  expect(elements[2].startBinding.elementId).toBe(elements[0].id);
  expect(elements[2].endBinding.elementId).toBe(elements[1].id);
  await drag(page, { x: 190, y: 485 }, { x: 220, y: 515 });
  elements = await saved(page);
  const endpoint = elements[2].points.at(-1);
  expect(elements[2].x + endpoint[0]).toBeCloseTo(150);
  expect(elements[2].y + endpoint[1]).toBeCloseTo(470);
  await page.screenshot({ path: 'artifacts/connected-arrow-mobile.png' });
});

for (const theme of ['light', 'dark']) test(`arrow center hints work before drawing and on both endpoint handles in ${theme}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto('/');
  if (theme === 'dark') {
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await drag(page, { x: 350, y: 250 }, { x: 510, y: 350 });
  await page.locator('[data-tool="text"]').click(); await page.mouse.click(750, 450);
  await page.locator('#text-editor').fill('Text center'); await page.keyboard.press('ControlOrMeta+Enter');
  const text = (await saved(page))[1], center = { x: text.x + text.width / 2, y: text.y + text.height / 2 };
  const hint = page.locator('#connector-center-hint');
  await page.locator('[data-tool="arrow"]').click(); await page.mouse.move(434, 303);
  await expect(hint).toBeVisible(); await expect(hint).toBeEmpty();
  const hintBox = (await hint.boundingBox())!;
  expect(hintBox.x).toBeCloseTo(425); expect(hintBox.y).toBeCloseTo(295);
  expect(hintBox.width).toBe(10); expect(hintBox.height).toBe(10);
  await page.screenshot({ path: `artifacts/arrow-center-hover-${theme}.png` });
  await page.mouse.down(); await page.mouse.move(center.x + 4, center.y - 3, { steps: 5 });
  await expect(hint).toBeVisible();
  await page.screenshot({ path: `artifacts/arrow-center-drawing-${theme}.png` });
  await page.mouse.up(); await expect(hint).toBeHidden();
  let wire = (await saved(page))[2];
  expect(wire.startBinding.fixedPoint).toEqual([.5, .5]); expect(wire.endBinding.fixedPoint).toEqual([.5, .5]);
  expect(wire.x).toBeCloseTo(430); expect(wire.y).toBeCloseTo(300);
  expect(wire.x + wire.points.at(-1)[0]).toBeCloseTo(center.x);
  expect(wire.y + wire.points.at(-1)[1]).toBeCloseTo(center.y);
  await page.mouse.move(430, 300); await page.mouse.down(); await page.mouse.move(438, 305);
  await expect(hint).toBeVisible(); await page.mouse.up(); await expect(hint).toBeHidden();
  await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x - 5, center.y + 3);
  await expect(hint).toBeVisible();
  await page.screenshot({ path: `artifacts/arrow-center-endpoint-${theme}.png` });
  await page.mouse.move(650, 600, { steps: 5 }); await expect(hint).toBeHidden(); await page.mouse.up();
  expect((await saved(page))[2].endBinding).toBeNull();
  await page.keyboard.press('ControlOrMeta+z'); wire = (await saved(page))[2];
  expect(wire.endBinding.fixedPoint).toEqual([.5, .5]);
  await page.reload(); wire = (await saved(page))[2]; expect(wire.endBinding.fixedPoint).toEqual([.5, .5]);
  await drag(page, { x: text.x + 10, y: text.y + 10 }, { x: text.x + 40, y: text.y + 50 });
  wire = (await saved(page))[2];
  expect(wire.x + wire.points.at(-1)[0]).toBeCloseTo(center.x + 30);
  expect(wire.y + wire.points.at(-1)[1]).toBeCloseTo(center.y + 40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile center hints follow an arrow from shape to text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.locator('[data-tool="rectangle"]').click();
  await drag(page, { x: 50, y: 200 }, { x: 190, y: 290 });
  await page.locator('[data-tool="text"]').click(); await page.mouse.click(60, 460);
  await page.locator('#text-editor').fill('Text center'); await page.keyboard.press('ControlOrMeta+Enter');
  const text = (await saved(page))[1], center = { x: text.x + text.width / 2, y: text.y + text.height / 2 };
  await page.locator('[data-tool="arrow"]').click();
  await page.mouse.move(124, 248); await page.mouse.down(); await expect(page.locator('#connector-center-hint')).toBeVisible();
  await page.mouse.move(center.x + 4, center.y - 3); await expect(page.locator('#connector-center-hint')).toBeVisible();
  const box = (await page.locator('#connector-center-hint').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/arrow-center-mobile.png' });
  await page.mouse.up(); await expect(page.locator('#connector-center-hint')).toBeHidden();
  const wire = (await saved(page))[2];
  expect(wire.startBinding.fixedPoint).toEqual([.5, .5]); expect(wire.endBinding.fixedPoint).toEqual([.5, .5]);
});

test('side midpoint hints snap both arrow handles precisely', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto('/');
  await page.locator('[data-tool="rectangle"]').click();
  await drag(page, { x: 350, y: 250 }, { x: 510, y: 350 });
  await page.locator('[data-tool="text"]').click(); await page.mouse.click(750, 450);
  await page.locator('#text-editor').fill('Text target'); await page.keyboard.press('ControlOrMeta+Enter');
  const text = (await saved(page))[1], left = { x: text.x, y: text.y + text.height / 2 };
  const hint = page.locator('#connector-center-hint');
  await page.locator('[data-tool="arrow"]').click(); await page.mouse.move(516, 306);
  await expect(hint).toBeVisible(); await expect(hint).toBeEmpty();
  await page.mouse.down(); await page.mouse.move(left.x - 4, left.y + 5, { steps: 5 });
  await expect(hint).toBeVisible(); await expect(hint).toBeEmpty();
  await page.screenshot({ path: 'artifacts/arrow-side-midpoints.png' });
  await page.mouse.up(); await expect(hint).toBeHidden();
  let wire = (await saved(page))[2];
  expect(wire.startBinding.fixedPoint).toEqual([1, .5]); expect(wire.endBinding.fixedPoint).toEqual([0, .5]);
  expect(wire.x).toBeCloseTo(510); expect(wire.y).toBeCloseTo(300);
  await page.mouse.move(510, 300); await page.mouse.down(); await page.mouse.move(437, 246, { steps: 5 });
  await expect(hint).toBeVisible(); await expect(hint).toBeEmpty(); await page.mouse.up();
  wire = (await saved(page))[2]; expect(wire.startBinding.fixedPoint).toEqual([.5, 0]);
  const bottom = { x: text.x + text.width / 2, y: text.y + text.height };
  await page.mouse.move(left.x, left.y); await page.mouse.down(); await page.mouse.move(bottom.x + 4, bottom.y + 3, { steps: 5 });
  await expect(hint).toBeVisible(); await expect(hint).toBeEmpty(); await page.mouse.up();
  wire = (await saved(page))[2]; expect(wire.endBinding.fixedPoint).toEqual([.5, 1]);
});
