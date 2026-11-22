import { expect, test, type Page } from '@playwright/test';

async function drag(page: Page, x: number, y: number, endX: number, endY: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.mouse.up();
}

async function savedElements(page: Page) {
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  return page.evaluate(() => JSON.parse(localStorage.getItem('sketchify.scene.v1')!).elements);
}

for (const theme of ['light', 'dark']) {
  for (const device of ['desktop', 'mobile']) {
    test(`draw an empty frame and save its child on ${device} in ${theme}`, async ({ page, browserName }) => {
      const mobile = device === 'mobile';
      await page.setViewportSize(mobile ? { width: theme === 'light' ? 320 : 375, height: 812 } : { width: 1440, height: 900 });
      await page.addInitScript(theme => {
        if (!localStorage.getItem('sketchify.scene.v1')) {
          localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [], local: { theme } }));
        }
      }, theme);
      await page.goto('/');
      const tools = page.getByRole('navigation', { name: 'Drawing tools' });
      const frameTool = tools.getByRole('button', { name: 'Frame', exact: true });
      await frameTool.click();
      await expect(frameTool).toHaveAttribute('aria-pressed', 'true');
      if (mobile) {
        const rows = await tools.getByRole('button').evaluateAll(buttons => [...new Set(buttons.map(button => button.getBoundingClientRect().top))]);
        expect(rows).toHaveLength(2);
      }
      const left = mobile ? 32 : 360;
      await drag(page, left, 240, left + 255, 480);
      const frame = (await savedElements(page))[0];
      expect(frame).toMatchObject({ type: 'frame', name: 'Frame', x: left, y: 240, width: 255, height: 240 });
      expect(await savedElements(page)).toHaveLength(1);

      await tools.getByRole('button', { name: 'Rectangle', exact: true }).click();
      await drag(page, left + 55, 290, left + 180, 360);
      const child = (await savedElements(page))[1];
      expect(child).toMatchObject({ type: 'rectangle', frameId: frame.id });
      await page.screenshot({ path: `artifacts/frame-tool-${device}-${theme}-${browserName}.png` });

      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      expect(await savedElements(page)).toHaveLength(1);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      expect((await savedElements(page))[1].frameId).toBe(frame.id);
      await page.reload();
      await page.getByRole('button', { name: 'Toggle pages and layers' }).click();
      await expect(page.locator(`[data-layer-key="e:${frame.id}"] [data-layer-key="e:${child.id}"]`)).toBeVisible();
    });
  }
}
