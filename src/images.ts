import type { Element } from './types';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const isImageData = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_IMAGE_BYTES * 4 / 3 + 100 && /^data:image\/(?:png|jpeg|webp|gif|avif|bmp);base64,[a-z\d+/]+={0,2}$/i.test(value);
interface ImageRecord { image: HTMLImageElement; ready: boolean; failed: boolean; promise: Promise<HTMLImageElement> }
const cache = new Map<string, ImageRecord>();
const listeners = new Set<() => void>();

export function imageRecord(data: string) {
  let record = cache.get(data);
  if (!record) {
    const image = new window.Image();
    record = { image, ready: false, failed: false, promise: Promise.resolve(image) };
    const entry = record;
    entry.promise = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) { entry.failed = true; reject(new Error('The image has no dimensions.')); }
        else { entry.ready = true; resolve(image); }
        for (const listener of listeners) listener();
      };
      image.onerror = () => { entry.failed = true; reject(new Error('The image could not be decoded.')); for (const listener of listeners) listener(); };
    });
    cache.set(data, entry);
    void entry.promise.catch(() => {});
    image.src = data;
  }
  return record;
}
export function subscribeImages(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function imagesReady(elements: Element[]) { return elements.every(element => element.type !== 'image' || !!element.imageData && imageRecord(element.imageData).ready); }
export async function loadImages(elements: Element[]) {
  await Promise.all(elements.filter(element => element.type === 'image').map(element => {
    if (!element.imageData || !isImageData(element.imageData)) throw new Error('The drawing contains a missing image.');
    return imageRecord(element.imageData).promise;
  }));
}
export async function readImage(blob: Blob) {
  if (!IMAGE_TYPES.includes(blob.type)) throw new Error('Paste a PNG, JPEG, WebP, GIF, AVIF, or BMP image.');
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('This image is larger than 20 MB. Try a smaller image.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  const data = `data:${blob.type};base64,${btoa(binary)}`;
  if (!isImageData(data)) throw new Error('The clipboard image is empty or invalid.');
  const image = await imageRecord(data).promise;
  return { data, width: image.naturalWidth, height: image.naturalHeight };
}
