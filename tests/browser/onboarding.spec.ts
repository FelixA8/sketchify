import { test, expect } from '@playwright/test';

test('welcome actions open files and help, and drawing clears the guidance', async ({ page }) => {
  await page.goto('/');
  const welcome = page.getByRole('region', { name: 'Empty canvas', exact: true });
  const navigationTip = page.getByRole('complementary', { name: 'Canvas navigation tip' });
  const chooser = page.waitForEvent('filechooser');
  await welcome.getByRole('button', { name: /^Open/ }).click();
  expect((await chooser).isMultiple()).toBe(false);
  const help = welcome.getByRole('button', { name: /^Help/ });
  await help.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(help).toBeFocused();
  await welcome.getByRole('button', { name: /^Create a shape/ }).click();
  await expect(page.locator('#canvas')).toBeFocused();
  await expect(welcome).toBeVisible();
  await expect(navigationTip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(welcome).toBeHidden();
  await expect(navigationTip).toBeHidden();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(welcome).toBeVisible();
});

test('hovering, clicking, panning, and choosing tools keep empty onboarding visible', async ({ page }) => {
  await page.goto('/');
  const welcome = page.locator('#welcome');
  await page.mouse.move(300, 350); await expect(welcome).toBeVisible();
  await page.mouse.click(300, 350); await expect(welcome).toBeVisible();
  await page.mouse.down(); await page.mouse.move(400, 450); await expect(welcome).toBeVisible();
  await page.mouse.up();
  await page.keyboard.down('Space'); await expect(welcome).toBeVisible();
  await page.mouse.move(300, 350); await page.mouse.down(); await page.mouse.move(400, 450);
  await expect(welcome).toBeVisible(); await page.mouse.up(); await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await expect(welcome).toBeVisible();
  const create = (await welcome.getByRole('button', { name: /^Create a shape/ }).boundingBox())!;
  await page.mouse.move(create.x + 10, create.y + create.height / 2); await page.mouse.down();
  await page.mouse.move(create.x + 110, create.y + create.height / 2 + 70); await page.mouse.up();
  await expect(welcome).toBeHidden();
});

for (const [width, height] of [[320, 568], [375, 812], [768, 900], [1024, 720], [1440, 900], [2048, 1020]]) {
  for (const theme of ['light', 'dark']) {
    test(`onboarding fits at ${width}×${height} in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(({ theme, width }) => localStorage.setItem('sketchify.scene.v1', JSON.stringify({
        elements: [], local: { theme, iconTextSize: width < 400 ? 'large' : 'medium' },
      })), { theme, width });
      await page.goto('/');
      const welcome = page.locator('#welcome');
      await expect(welcome).toBeVisible();
      const box = (await welcome.boundingBox())!;
      const toolbar = (await page.locator('#toolbar').boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height);
      if (width <= 760) {
        expect(box.y + box.height).toBeLessThanOrEqual(toolbar.y);
        await expect(page.locator('.onboarding-tools')).toBeHidden();
        await expect(welcome.getByText('Pick a tool below to start drawing.')).toBeVisible();
      }
      if (width > 960) {
        const navigation = (await page.locator('.onboarding-navigation h2').boundingBox())!;
        const shortcuts = (await page.locator('.onboarding-help h2').boundingBox())!;
        expect(shortcuts.y - navigation.y).toBeCloseTo(50, 0);
      }
      const help = welcome.getByRole('button', { name: /^Help/ });
      await help.scrollIntoViewIfNeeded();
      await help.click(); await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape'); await expect(help).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/onboarding-${width}-${theme}.png` });
    });
  }
}

for (const width of [375, 768, 1152, 1440, 2048]) {
  for (const theme of ['light', 'dark']) {
    test(`open Pages/Layers leaves onboarding readable at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(theme => localStorage.setItem('sketchify.scene.v1', JSON.stringify({
        elements: [], local: { theme, sidebar: true, iconTextSize: 'large' },
      })), theme);
      await page.goto('/');
      const welcome = page.locator('#welcome');
      const workspace = page.getByRole('complementary', { name: 'Pages and layers', exact: true });
      await expect(workspace).toBeVisible();
      if (width <= 760) {
        await expect(welcome).toBeHidden();
        await expect(welcome.getByRole('button', { name: /^Help/ })).toBeHidden();
      } else {
        await expect(welcome).toBeVisible();
        const panel = (await workspace.boundingBox())!;
        for (const target of [welcome, page.locator('.onboarding-tip')]) {
          for (const item of await target.all()) {
            if (!await item.isVisible()) continue;
            const box = (await item.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(panel.x + panel.width + 16);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
          }
        }
        const help = welcome.getByRole('button', { name: /^Help/ });
        await help.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(help).toBeFocused();
      }
      await page.screenshot({ path: `artifacts/onboarding-workspace-${width}-${theme}.png` });
      await workspace.getByRole('button', { name: 'Close sidebar', exact: true }).click();
      await expect(welcome).toBeVisible();
      const restored = (await welcome.boundingBox())!;
      expect(Math.abs(restored.x + restored.width / 2 - width / 2)).toBeLessThan(1);
      await expect(welcome.getByRole('button', { name: /^Open/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

for (const theme of ['light', 'dark']) test(`left onboarding follows live sidebar resizing in ${theme}`, async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(theme => {
    if (sessionStorage.getItem('onboarding-resize-seeded')) return;
    sessionStorage.setItem('onboarding-resize-seeded', 'true');
    localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [], local: { theme, sidebar: true } }));
  }, theme);
  await page.goto('/');
  const panel = page.locator('#workspace');
  const edge = page.getByRole('separator', { name: 'Resize pages and layers' });
  const menu = page.locator('.onboarding-menu'), navigation = page.locator('.onboarding-navigation');
  const welcome = page.locator('#welcome');
  const checkLayout = async (width: number) => {
    await expect.poll(async () => (await panel.boundingBox())?.width).toBe(width);
    await expect(menu).toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(welcome).toBeVisible();
    const sidebar = (await panel.boundingBox())!;
    const files = (await menu.boundingBox())!, pan = (await navigation.boundingBox())!, actions = (await welcome.boundingBox())!;
    const sidebarRight = sidebar.x + sidebar.width;
    expect(files.x).toBeCloseTo(sidebarRight + 24, 1);
    expect(pan.x).toBeCloseTo(sidebarRight + 24, 1);
    expect(actions.x + actions.width / 2).toBeCloseTo((sidebarRight + 1440) / 2, 1);
    expect(files.y + files.height).toBeLessThan(actions.y);
    expect(pan.y).toBeGreaterThan(actions.y + actions.height);
  };
  await checkLayout(168);
  await expect(page.locator('.onboarding-tools')).toBeVisible();
  const handle = (await edge.boundingBox())!;
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 420 - 168, y, { steps: 8 });
  await expect(edge).toHaveAttribute('data-resizing', 'true');
  await checkLayout(420);
  await expect(page.locator('.onboarding-tools')).toBeHidden();
  await page.screenshot({ path: `artifacts/onboarding-resized-workspace-${theme}-${browserName}.png` });

  await page.mouse.move(x + 1010 - 168, y, { steps: 8 });
  await checkLayout(1010);
  await expect(page.locator('.onboarding-help')).toBeHidden();
  await page.mouse.up();
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();
  await checkLayout(1010);

  await edge.press('End');
  await expect(menu).toBeHidden();
  await expect(navigation).toBeHidden();
  await expect(welcome).toBeHidden();
  await edge.press('Home');
  await checkLayout(168);
  await expect(page.locator('.onboarding-tools')).toBeVisible();
});

test('zen mode centers onboarding when the saved Pages/Layers panel is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.addInitScript(() => localStorage.setItem('sketchify.scene.v1', JSON.stringify({
    elements: [], local: { sidebar: true, sidebarWidth: 700, preferences: { zenMode: true } },
  })));
  await page.goto('/');
  const welcome = page.locator('#welcome');
  await expect(welcome).toBeVisible();
  await expect(page.locator('#workspace')).toBeHidden();
  const box = (await welcome.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 512)).toBeLessThan(1);
});
