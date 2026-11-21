import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GlobalFonts } from '@napi-rs/canvas';
export function compatibilityFont() {
  const require = createRequire(import.meta.url);
  const path = join(dirname(require.resolve('next/package.json')), 'dist/compiled/@vercel/og/Geist-Regular.ttf');
  const bytes = readFileSync(path);
  // Use the locked framework's font only in golden tests, independent of host fonts.
  GlobalFonts.removeAll();
  if (!GlobalFonts.register(bytes, 'Arial')) throw new Error('Cannot register compatibility-test font');
  return createHash('sha256').update(bytes).digest('hex');
}
