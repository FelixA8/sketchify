import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) for (const size of ['small', 'large']) test(`refresh keeps the saved ${size} controls at ${width}px and hides empty onboarding before hydration`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(size => localStorage.setItem('sketchify.scene.v1', JSON.stringify({
    elements: [{ id: 'saved', type: 'rectangle', x: 350, y: 250, width: 120, height: 80 }],
    local: { theme: 'dark', background: '#fffce8', iconTextSize: size, zoom: 1.5, preferences: { toolbarHints: false } },
  })), size);
  let release!: () => void;
  const hydrationGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/**/*.js*', async route => { await hydrationGate; await route.continue(); });
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('#welcome')).toBeHidden();
    await expect(page.locator('.onboarding-hints')).toBeHidden();
    await expect(page.locator('#tool-hint')).toBeHidden();
    await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(41, 39, 25)');
    const toolbar = await page.locator('#toolbar').boundingBox();
    release();
    await expect(page.locator('html')).not.toHaveAttribute('data-startup');
    await expect(page.locator('#app')).toHaveAttribute('data-panel-size', size);
    await expect(page.locator('#zoom-reset')).toHaveText('150%');
    await expect(page.locator('#welcome')).toBeHidden();
    expect(await page.locator('#toolbar').boundingBox()).toEqual(toolbar);
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await expect(page.locator('#menu')).toBeVisible();
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('saved zen mode does not flash the normal toolbar during refresh', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sketchify.scene.v1', JSON.stringify({
    elements: [], local: { preferences: { zenMode: true } },
  })));
  let release!: () => void;
  const hydrationGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/**/*.js*', async route => { await hydrationGate; await route.continue(); });
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#toolbar')).toBeHidden();
    await expect(page.locator('#welcome')).toBeVisible();
    release();
    await expect(page.locator('#exit-zen')).toBeVisible();
    await expect(page.locator('#toolbar')).toBeHidden();
    await page.locator('#exit-zen').click();
    await expect(page.locator('#toolbar')).toBeVisible();
  } finally { release(); }
});

test('initial document already contains canvas and controls without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.locator('#canvas')).toBeVisible();
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.locator('#menu-button')).toBeVisible();
  await expect(page.getByText('Loading Sketchify…', { exact: true })).toHaveCount(0);
  await context.close();
});

test('startup stays interactive and updates welcome text when a delayed handwriting font loads', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  let release!: () => void;
  const fontGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/fonts/patrick-hand/PatrickHand-Regular.ttf', async route => { await fontGate; await route.continue(); });
  const fontStatus = () => page.evaluate(() => [...document.fonts].find(face => face.family.replace(/["']/g, '') === 'Patrick Hand')?.status);
  const textWidths = () => page.locator('#welcome h1, .welcome-subtitle, .onboarding-navigation h2').evaluateAll(elements => elements.map(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().width;
  }));
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.getByText('Loading Sketchify…', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
    await page.locator('#canvas').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#save-state')).toHaveText('Saved on this device');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements[0].type)).toBe('rectangle');
    await page.locator('#canvas').focus(); await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('#selection-info')).toHaveText('');
    await expect(page.locator('#welcome h1')).toBeVisible();
    await expect(page.locator('.onboarding-navigation h2')).toBeVisible();
    const fallbackWidths = await textWidths();
    release();
    await expect.poll(fontStatus).toBe('loaded');
    await expect.poll(async () => (await textWidths()).map((width, index) => width !== fallbackWidths[index])).toEqual([true, true, true]);
    await page.screenshot({ path: 'artifacts/startup-no-loader.png' });
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('failed handwriting font leaves the canvas interactive', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/fonts/patrick-hand/PatrickHand-Regular.ttf', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.mouse.click(450, 300); await page.keyboard.type('Local text');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements[0].text)).toBe('Local text');
  await expect(page.getByText('Loading Sketchify…', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const [theme, background, expected] of [
  ['dark', '#fffce8', 'rgb(41, 39, 25)'],
  ['dark', '#ffffff', 'rgb(18, 18, 18)'],
  ['light', '#ffffff', 'rgb(255, 255, 255)'],
  ['light', '#fffce8', 'rgb(255, 252, 232)'],
]) test(`saved ${theme} canvas background ${background} is present before hydration`, async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ theme, background }) => localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [], local: { theme, background } })), { theme, background });
  let release!: () => void;
  const hydrationGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/**/*.js*', async route => { await hydrationGate; await route.continue(); });
  try {
    await page.reload({ waitUntil: 'commit' });
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('background-color', expected);
    await expect(page.locator('#app')).toHaveCSS('background-color', expected);
    await page.screenshot({ path: `artifacts/startup-${theme}-${background.slice(1)}-before-hydration.png` });
    release();
    await expect(page.locator('#save-state')).toHaveText('Saved on this device');
    await expect(page.locator('#app')).toHaveCSS('background-color', expected);
    await expect(page.locator('html')).toHaveCSS('background-color', expected);
  } finally { release(); }
});
