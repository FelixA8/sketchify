import { build } from 'esbuild';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const result = await build({ entryPoints: [resolve(root, 'vendor/excalidraw-source.ts')], bundle: true, format: 'cjs', platform: 'node', write: false });
const referenceModule = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, { module: referenceModule, exports: referenceModule.exports, console, performance });
const upstream = referenceModule.exports;
const fixtures = [];
const base = { x: 24, y: 30, width: 200, height: 120, strokeColor: '#1b1b1f', backgroundColor: 'transparent', strokeWidth: 2, strokeStyle: 'solid', fillStyle: 'hachure', roughness: 1, seed: 142, points: [], roundness: null, simulatePressure: true, pressures: [] };
function add(name, element, dark = false) {
  const shape = upstream.generateElementShape(element, new upstream.RoughGenerator(), { isExporting: false, canvasBackgroundColor: '#ffffff', embedsValidationStatus: null, theme: dark ? 'dark' : 'light' });
  const value = !shape ? [] : (Array.isArray(shape) ? shape : [shape]).map(s => typeof s === 'string' ? s : { shape: s.shape, sets: s.sets });
  fixtures.push({ name, element, dark, hash: createHash('sha256').update(JSON.stringify(value)).digest('hex') });
}
for (const type of ['rectangle', 'diamond', 'ellipse', 'line', 'arrow']) {
  for (const roughness of [0, 1, 2]) {
    for (const strokeStyle of ['solid', 'dashed', 'dotted']) {
      for (const [width, height] of [[200, 120], [40, 18], [8, 6]]) {
        const element = { ...base, type, roughness, strokeStyle, width, height, points: ['line', 'arrow'].includes(type) ? [[0, 0], [width, height]] : [] };
        add(`${type}/${roughness}/${strokeStyle}/${width}`, element);
      }
    }
    if (['rectangle', 'diamond', 'ellipse'].includes(type)) for (const fillStyle of ['solid', 'hachure', 'cross-hatch']) {
      add(`${type}/${roughness}/${fillStyle}`, { ...base, type, roughness, fillStyle, backgroundColor: '#a5d8ff', seed: 741, strokeWidth: 4 });
    }
    if (type !== 'ellipse') {
      add(`${type}/${roughness}/rounded`, { ...base, type, roughness, roundness: { type: type === 'rectangle' ? 3 : 2 }, points: ['line', 'arrow'].includes(type) ? [[0, 0], [70, 90], [200, 120]] : [] });
    }
    add(`${type}/${roughness}/dark`, { ...base, type, roughness, points: ['line', 'arrow'].includes(type) ? [[0, 0], [200, 120]] : [], backgroundColor: '#b2f2bb' }, true);
  }
}
for (const simulatePressure of [false, true]) {
  add(`freedraw/${simulatePressure}`, { ...base, type: 'freedraw', points: [[0, 0], [20, 40], [55, 30], [90, 65], [150, 10], [200, 80]], simulatePressure, pressures: [.2, .5, .8, .9, .4, .1] });
}
for (const endArrowhead of ['arrow', 'bar', 'triangle', 'diamond', 'circle_outline']) {
  add(`arrowhead/${endArrowhead}`, { ...base, type: 'arrow', width: 120, height: 75, points: [[0, 0], [120, 0], [120, 75]], endArrowhead, roughness: 2 });
}
const provenance = JSON.parse(await readFile(resolve(root, 'vendor/provenance.json'), 'utf8'));
await mkdir(resolve(root, 'tests/fixtures'), { recursive: true });
await writeFile(resolve(root, 'tests/fixtures/excalidraw-renderer.json'), JSON.stringify({ commit: provenance.commit, roughjs: '4.6.4', sourceSha256: createHash('sha256').update(await readFile(resolve(root, 'vendor/excalidraw-source.ts'))).digest('hex'), fixtures }, null, 2) + '\n');
console.log(`Recorded ${fixtures.length} fixtures directly from the pinned upstream source, without the local renderer adapter.`);
