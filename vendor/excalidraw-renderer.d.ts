import { RoughGenerator } from 'roughjs/bin/generator';
import type { Drawable } from 'roughjs/bin/core';
import type { Element } from '../src/types';
export { RoughGenerator };
export function generateElementShape(element: Element, generator: RoughGenerator, options: {
  isExporting: boolean; canvasBackgroundColor: string; embedsValidationStatus: null; theme: string;
}): Drawable | string | (Drawable | string)[] | null;
export function applyDarkModeFilter(color: string, enable?: boolean): string;
