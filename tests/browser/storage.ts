import type { Page } from '@playwright/test';

export async function seedStorage(page: Page, scene: unknown, entries: Record<string, string> = {}) {
  await page.addInitScript(values => {
    if (location.pathname !== '/' || sessionStorage.getItem('sketchify.test.seeded')) return;
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    sessionStorage.setItem('sketchify.test.seeded', 'true');
  }, { ...entries, 'sketchify.scene.v1': JSON.stringify(scene) });
}
