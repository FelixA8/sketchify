import { createHash } from 'node:crypto';

export function rendererHashes(shape) {
  const shapes = !shape ? [] : Array.isArray(shape) ? shape : [shape];
  const operations = shapes.map(value => typeof value === 'string' ? value : { shape: value.shape, sets: value.sets });
  const hash = json => createHash('sha256').update(json).digest('hex');
  // Trigonometric results can differ in their last bits across V8 platforms.
  const rounded = (_key, value) => typeof value === 'number' ? Number(value.toFixed(8)) : value;
  return { hash: hash(JSON.stringify(operations)), roundedHash: hash(JSON.stringify(operations, rounded)) };
}
