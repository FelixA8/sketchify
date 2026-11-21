import { createElement } from '../scene';
import { readImage } from '../images';
import type { Element, Point } from '../types';
import type { Controller } from './controller';

export class ImageActions {
  constructor(readonly app: Controller) {}
  async paste(blobs: Blob[], point?: Point) {
    const a = this.app;
    try {
      const images = await Promise.all(blobs.map(readImage));
      if (a.abort.signal.aborted || !images.length) return;
      a.run(() => {
        a.text.finish(); a.finishGesture(); a.state.contextMenu = null;
        const availableWidth = Math.max(100, a.width - (a.state.panel && innerWidth > 760 ? 280 : 48));
        const availableHeight = Math.max(100, a.height - 180);
        const elements: Element[] = images.map((image, index) => {
          const scale = Math.min(1, availableWidth / (image.width * a.state.zoom), availableHeight / (image.height * a.state.zoom));
          return { ...createElement('image', index * 20, index * 20), width: image.width * scale, height: image.height * scale, imageData: image.data, scale: [1, 1], status: 'saved' };
        });
        a.insert(elements, point);
      });
    } catch (error) {
      if (!a.abort.signal.aborted) a.toast(error instanceof Error ? error.message : 'Could not paste this image.', true);
    }
  }
}
