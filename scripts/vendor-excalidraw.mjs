import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const commit = '701b901a0f1ba3d0b390d9cdf63d112e25abac4b';
const root = fileURLToPath(new URL('..', import.meta.url));
const sourceDirectory = process.argv[2];
const checking = sourceDirectory === '--check';
const selections = {
  'shape': ['getDashArrayDashed', 'getDashArrayDotted', 'adjustRoughness', 'generateRoughOptions', 'modifyIframeLikeForRoughOptions', 'generateArrowheadCardinalityOne', 'generateArrowheadLinesToTip', 'getArrowheadLineOptions', 'generateArrowheadOutlineCircle', 'fillArrowheadOutline', 'getArrowheadShapes', 'getFreedrawFillCurvePoints', '_generateElementShape', 'ELBOW_ARROW_CORNER_RADIUS', 'generateElbowArrowShape', 'getFreeDrawSvgPath', 'VARIABLE_WIDTH_FREEDRAW', 'CONSTANT_WIDTH_FREEDRAW', 'getFreedrawStreamline', 'getVariableWidthFreedrawOutline', 'createLaserPointer', 'getConstantWidthFreedrawOutline', 'getFreedrawOutlinePoints', 'med', 'TO_FIXED_PRECISION', 'getSvgPathFromStroke'],
  'bounds': ['getDiamondPoints', 'CARDINALITY_MARKER_SIZE', 'CROWFOOT_ARROWHEAD_SIZE', 'CARDINALITY_ONE_OR_MANY_BAR_OFFSET', 'CARDINALITY_INNER_BAR_OFFSET', 'CARDINALITY_ZERO_CIRCLE_OFFSET', 'CARDINALITY_ZERO_CIRCLE_SCALE', 'getArrowheadSize', 'ARROW_ARROWHEAD_ANGLE', 'ARROW_ARROWHEAD_WIDEST_ANGLE', 'ARROW_ARROWHEAD_WIDEST_SIZE', 'getArrowheadAngle', 'getArrowheadCorner', 'getSidesClearSize', 'isCardinalityArrowhead', 'getCardinalityMarkerScale', 'getArrowheadSizeBeyondLastSegment', 'getArrowheadPoints'],
  'utils': ['isPathALoop', 'getCornerRadius'],
  'constants': ['ROUGHNESS', 'ROUNDNESS', 'DEFAULT_ADAPTIVE_RADIUS', 'DEFAULT_PROPORTIONAL_RADIUS', 'LINE_CONFIRM_THRESHOLD', 'THEME', 'DEFAULT_STROKE_STREAMLINE'],
  'colors': ['DARK_MODE_COLORS_CACHE', 'DARK_MODE_FILTER_INVERT_PERCENT', 'DARK_MODE_FILTER_HUE_ROTATE_DEGREES', 'cssHueRotate', 'cssInvert', 'applyDarkModeFilter', 'rgbToHex', 'isTransparent'],
  'typeChecks': ['isLinearElement', 'isLinearElementType', 'isArrowElement', 'isElbowArrow', 'isIframeLikeElement', 'isIframeElement', 'isEmbeddableElement'],
  'comparisons': ['canChangeRoundness'],
  'heading': ['HEADING_RIGHT', 'HEADING_DOWN', 'HEADING_LEFT', 'HEADING_UP', 'vectorToHeading', 'headingForPoint', 'headingForPointIsHorizontal', 'compareHeading', 'headingIsHorizontal'],
  'point': ['pointFrom', 'pointFromArray', 'pointRotateRads', 'pointDistance'],
  'vector': ['vector', 'vectorFromPoint', 'vectorMagnitudeSq', 'vectorDot'],
  'shape-utils': ['getCurvePathOps'],
  'angle': ['degreesToRadians'],
  'math-utils': ['clamp'],
};

if (sourceDirectory && !checking) {
  const pinned = JSON.parse(await readFile(resolve(root, 'vendor/provenance.json'), 'utf8'));
  for (const entry of pinned.sources) {
    const bytes = await readFile(resolve(sourceDirectory, `sketchify-upstream-${entry.file}.ts`));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Pinned source mismatch: ${entry.file}`);
  }
  const headers = `// Extracted without algorithm changes from excalidraw/excalidraw@${commit}.\n// MIT license: see licenses/excalidraw.txt.\nimport { RoughGenerator } from 'roughjs/bin/generator.js';\nimport { simplify } from 'points-on-curve';\nimport { getStroke } from 'perfect-freehand';\nimport { LaserPointer } from '@excalidraw/laser-pointer';\nimport tinycolor from 'tinycolor2';\nconst invariant = (condition, message) => { if (!condition) throw new Error(message); };\nconst assertNever = (_value, message) => { throw new Error(message); };\n`;
  const sections = [headers], provenance = [];
  for (const [file, names] of Object.entries(selections)) {
    const source = await readFile(resolve(sourceDirectory, `sketchify-upstream-${file}.ts`), 'utf8');
    const declarations = [...source.matchAll(/^(?:export )?(?:const|function|class|type|interface)\s+(\w+)/gm)];
    const found = new Set();
    for (const [index, declaration] of declarations.entries()) {
      if (!names.includes(declaration[1])) continue;
      found.add(declaration[1]);
      sections.push(source.slice(declaration.index, declarations[index + 1]?.index || source.length).trim());
    }
    for (const name of names) if (!found.has(name)) throw new Error(`Missing upstream declaration: ${file}:${name}`);
    provenance.push({ file, sha256: createHash('sha256').update(source).digest('hex'), declarations: names });
  }
  sections.push('export { _generateElementShape as generateElementShape, RoughGenerator };');
  await mkdir(resolve(root, 'vendor/licenses'), { recursive: true });
  await writeFile(resolve(root, 'vendor/excalidraw-source.ts'), sections.join('\n\n'));
  await writeFile(resolve(root, 'vendor/provenance.json'), JSON.stringify({ repository: 'https://github.com/excalidraw/excalidraw', commit, sources: provenance }, null, 2) + '\n');
  await copyFile(resolve(sourceDirectory, 'sketchify-excalidraw-LICENSE'), resolve(root, 'vendor/licenses/excalidraw.txt'));
}

for (const [name, file] of checking ? [] : [['roughjs', 'LICENSE'], ['perfect-freehand', 'LICENSE'], ['tinycolor2', 'LICENSE'], ['points-on-curve', 'LICENSE'], ['@excalidraw/laser-pointer', 'LICENSE'], ['hachure-fill', 'LICENSE'], ['path-data-parser', 'LICENSE'], ['points-on-path', 'LICENSE'], ['next', 'license.md'], ['react', 'LICENSE'], ['react-dom', 'LICENSE'], ['immer', 'LICENSE']]) {
  try { await copyFile(resolve(root, 'node_modules', name, file), resolve(root, 'vendor/licenses', `${name.replaceAll('/', '-')}.txt`)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const result = await build({ entryPoints: [resolve(root, 'vendor/excalidraw-source.ts')], outfile: resolve(root, 'vendor/excalidraw-renderer.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2020', legalComments: 'inline', write: !checking });
if (checking && !Buffer.from(result.outputFiles[0].contents).equals(await readFile(resolve(root, 'vendor/excalidraw-renderer.js')))) throw new Error('Vendor bundle differs from its retained source. Run npm run vendor.');
console.log(`Bundled the Excalidraw renderer from ${commit}.`);
