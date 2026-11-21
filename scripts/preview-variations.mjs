import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { createElement, STROKE_VARIATION_SEEDS } from '../src/scene.ts';
import { renderPaths } from '../src/strokes.ts';
const canvas = createCanvas(1280, 890);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#25252b'; ctx.font = '25px Arial'; ctx.fillText('Five stroke variations', 36, 42);
ctx.fillStyle = '#62626f'; ctx.font = '14px Arial'; ctx.fillText('New shapes choose a variation randomly. The Sloppiness setting controls its intensity.', 36, 69);

function paint(type, x, y, width, height, roughness, seed) {
  const element = { ...createElement(type, x, y, { seed }), width, height, roughness, points: type === 'arrow' ? [[0, 0], [width, height]] : [] };
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const path of renderPaths(element)) {
    ctx.setLineDash(path.dash);
    if (path.fill !== 'none') { ctx.fillStyle = path.fill; ctx.fill(new Path2D(path.d), path.fillRule); }
    if (path.stroke !== 'none') { ctx.strokeStyle = path.stroke; ctx.lineWidth = path.strokeWidth; ctx.stroke(new Path2D(path.d)); }
  }
  ctx.restore();
}

for (const [index, seed] of STROKE_VARIATION_SEEDS.entries()) {
  const x = 40 + index * 247;
  ctx.fillStyle = '#25252b'; ctx.font = '16px Arial'; ctx.fillText(`Variation ${index + 1}`, x, 111);
  for (const roughness of [1, 2]) {
    const y = roughness === 1 ? 165 : 545;
    paint('rectangle', x, y, 195, 95, roughness, seed);
    paint('ellipse', x, y + 135, 195, 80, roughness, seed);
    paint('arrow', x, y + 270, 195, 12, roughness, seed);
  }
}
ctx.fillStyle = '#62626f'; ctx.font = '13px Arial';
ctx.fillText('Artist · roughness 1', 40, 145);
ctx.fillText('Cartoonist · roughness 2', 40, 525);
ctx.fillText('Each shape keeps its variation when moved, saved, or reloaded.', 40, 868);
const directory = new URL('../artifacts/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('roughness-variations.png', directory), canvas.toBuffer('image/png'));
console.log('Rendered artifacts/roughness-variations.png');
