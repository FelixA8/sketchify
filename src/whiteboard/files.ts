import { exportScene, importScene, sceneBounds, unrotatedBounds } from '../scene';
import { svg as textSVG } from '../text';
import { renderPaths } from '../strokes';
import { drawElement } from './canvas';
import type { Element, ImportResult } from '../types';
import type { Controller } from './controller';
import { fontsForExport, type EmbeddedFont } from '../fonts';
import { snapshot, type State } from './store';
import { imagesReady, loadImages } from '../images';
import { blankPage, projectData, readProject, type Layers, type Project } from './project';
import { visibleElements } from './layers';
import { CANVAS_BACKGROUNDS } from '../appearance';
import { noteDate } from '../notes';
export interface ExportOptions { scale?: number; dark?: boolean; maxDimension?: number; canvasBackground?: string }
export function exportBackground(background: string, dark: boolean) {
  const pair = CANVAS_BACKGROUNDS.find(pair => pair.light === background || pair.dark === background);
  return pair ? dark ? pair.dark : pair.light : background;
}
export function exportDimensions(elements: Element[], requested = 2, maxDimension = 8192) {
  const bounds = sceneBounds(elements), scale = Math.min(requested, maxDimension / Math.max(bounds.width + 48, bounds.height + 48));
  return { bounds, scale, width: Math.ceil((bounds.width + 48) * scale), height: Math.ceil((bounds.height + 48) * scale), limited: scale < requested };
}
export const escapeXML = (text: unknown) => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function svgDocument(elements: Element[], background: string | null, ctx: CanvasRenderingContext2D, fonts: EmbeddedFont[] = [], options: ExportOptions = {}) {
  const { dark = false, scale = 1, canvasBackground = background ?? (dark ? '#121212' : '#ffffff') } = options;
  const b = sceneBounds(elements), padding = 24, w = Math.ceil(b.width + padding * 2), h = Math.ceil(b.height + padding * 2);
  let contents = fonts.length ? `<metadata>${escapeXML([...new Set(fonts.map(font => font.license))].join('\n\n'))}</metadata><defs><style>${fonts.map(font => `@font-face{font-family:'${font.family}';src:url(data:font/${font.format === 'woff2' ? 'woff2' : 'ttf'};base64,${font.data}) format('${font.format}');font-weight:400;font-style:normal;${font.unicodeRange ? `unicode-range:${font.unicodeRange};` : ''}}`).join('')}</style></defs>` : '';
  for (const e of elements) {
    let content = '';
    if (e.type === 'text') content = textSVG(e, ctx, dark);
    else if (e.type === 'image' && e.imageData) {
      const b = unrotatedBounds(e), [sx, sy] = e.scale ?? [1, 1];
      content = `<image href="${escapeXML(e.imageData)}" width="${b.width}" height="${b.height}" opacity="${e.opacity / 100}" preserveAspectRatio="none" transform="translate(${b.x + (sx < 0 ? b.width : 0)} ${b.y + (sy < 0 ? b.height : 0)}) scale(${sx} ${sy})"/>`;
    }
    else {
      const box = unrotatedBounds(e), linear = ['line', 'arrow', 'freedraw'].includes(e.type);
      content = `<g opacity="${e.opacity / 100}" transform="translate(${linear ? e.x : box.x} ${linear ? e.y : box.y})">${renderPaths(e, dark, canvasBackground).map(path => `<path d="${path.d}" fill="${escapeXML(path.fill)}" fill-rule="${path.fillRule}" stroke="${escapeXML(path.stroke)}" stroke-width="${path.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${path.dash.length ? ` stroke-dasharray="${path.dash.join(' ')}"` : ''}/>`).join('')}</g>`;
      if (e.type === 'frame') content += `<text x="${box.x}" y="${box.y - 5}" font-family="sans-serif" font-size="12" fill="${escapeXML(dark && ['#1b1b1f', '#1e1e1e', '#000000'].includes(e.strokeColor) ? '#eeeeef' : e.strokeColor)}">${escapeXML(e.name || 'Frame')}</text>`;
      if (e.type === 'stickynote') content += `<text x="${box.x + box.width - 16}" y="${box.y + box.height - 14}" font-family="Helvetica, Arial, sans-serif" font-size="12" text-anchor="end" opacity="${e.opacity / 100}" fill="${escapeXML(dark && ['#1b1b1f', '#1e1e1e', '#000000'].includes(e.strokeColor) ? '#eeeeef' : e.strokeColor)}">${escapeXML(noteDate(e))}</text>`;
    }
    if (e.angle && e.type !== 'text') { const b = unrotatedBounds(e); content = `<g transform="rotate(${e.angle * 180 / Math.PI} ${b.x + b.width / 2} ${b.y + b.height / 2})">${content}</g>`; }
    contents += content;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="${b.x - padding} ${b.y - padding} ${w} ${h}">${background ? `<rect x="${b.x - padding}" y="${b.y - padding}" width="${w}" height="${h}" fill="${escapeXML(background)}"/>` : ''}${contents}</svg>`;
}
export class FileActions {
  pending: { result: ImportResult; name: string; project?: Project } | null = null;
  private urls = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;
  constructor(readonly app: Controller) {}
  dispose() { this.disposed = true; for (const [url, timer] of this.urls) { clearTimeout(timer); URL.revokeObjectURL(url); } this.urls.clear(); }
  download(content: Blob | string, type: string, extension: string) {
    if (this.disposed) return;
    const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
    const link = document.createElement('a'); link.href = url;
    link.download = `${this.app.state.name.replace(/[^\p{L}\p{N}_ -]/gu, '').trim() || 'Untitled'}.${extension}`;
    document.body.append(link); link.click(); link.remove();
    this.urls.set(url, setTimeout(() => { URL.revokeObjectURL(url); this.urls.delete(url); }, 30000));
  }
  save() {
    const a = this.app; a.workspace.finish(); this.download(JSON.stringify(projectData(a.state), null, 2), 'application/json', 'sketchify');
    a.toast('Project saved with all pages.');
  }
  export(format: string, selected: boolean, background: boolean, options: ExportOptions = {}) {
    const a = this.app; a.workspace.finish();
    const all = selected ? a.objects.selected() : a.state.elements;
    const elements = format === 'json' ? all : visibleElements(all, a.state.layers, a.state.elements);
    if (!elements.length) { a.toast('No visible elements to export. Show a layer or change the export scope.', true); return; }
    if (format === 'json') {
      this.download(exportScene(elements, { viewBackgroundColor: a.state.background, sketchifyLayers: a.state.layers }), 'application/json', 'excalidraw');
      a.toast('Editable page exported.');
    }
    else if (format === 'svg') {
      options = { ...options, canvasBackground: exportBackground(a.state.background, options.dark ?? false) };
      const color = background ? options.canvasBackground ?? null : null;
      if (elements.some(e => e.type === 'text' && [1, 5].includes(e.fontFamily))) {
        a.toast('Preparing SVG…'); void this.handwrittenSVG(snapshot(elements), color, options);
      }
      else { this.download(svgDocument(elements, color, a.ctx, [], options), 'image/svg+xml', 'svg'); a.toast('SVG exported.'); }
    }
    else { a.toast('Preparing PNG…'); this.png(elements, background, this.exportState(), options); }
  }
  private async handwrittenSVG(elements: Element[], background: string | null, options: ExportOptions) {
    try {
      const fonts = await fontsForExport(elements);
      if (this.disposed) return;
      this.download(svgDocument(elements, background, this.app.ctx, fonts, options), 'image/svg+xml', 'svg');
      this.app.toast('SVG exported.');
    } catch { if (!this.disposed) this.app.toast('Could not load the font for SVG export. Please try again.', true); }
  }
  async copyImage(selected: boolean, background: boolean, options: ExportOptions) {
    const a = this.app; a.workspace.finish();
    const elements = visibleElements(selected ? a.objects.selected() : a.state.elements, a.state.layers, a.state.elements);
    if (!elements.length) { a.toast('No visible elements to copy. Show a layer or change the export scope.', true); return; }
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard unavailable');
      // Pass the promise immediately so Safari retains the click's clipboard permission.
      const blob = this.pngBlob(elements, background, options);
      void blob.catch(() => {});
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      if (!this.disposed) a.toast('PNG copied to clipboard.');
    } catch { if (!this.disposed) a.toast('Could not copy the image. Allow clipboard access in your browser, or download PNG instead.', true); }
  }
  pngCanvas(elements: Element[], background: boolean, state = this.app.state, options: ExportOptions = {}) {
    elements = visibleElements(elements, state.layers, state.elements);
    const { bounds: b, scale, width, height } = exportDimensions(elements, options.scale, options.maxDimension), padding = 24;
    state = { ...state, theme: options.dark ? 'dark' : 'light', background: exportBackground(state.background, options.dark ?? false) };
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    const target = output.getContext('2d')!;
    if (background) { target.fillStyle = state.background; target.fillRect(0, 0, output.width, output.height); }
    target.scale(scale, scale); target.translate(padding - b.x, padding - b.y);
    for (const element of elements) drawElement(element, target, state, options.dark ?? false);
    return output;
  }
  async pngBlob(elements: Element[], background: boolean, options: ExportOptions = {}): Promise<Blob> {
    const state = this.exportState();
    elements = snapshot(visibleElements(elements, state.layers, state.elements));
    await loadImages(elements);
    const output = this.pngCanvas(elements, background, state, options);
    return new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
  }
  private exportState(): State { return { ...this.app.state, elements: snapshot(this.app.state.elements), layers: snapshot(this.app.state.layers) }; }
  png(elements: Element[], background: boolean, state = this.exportState(), options: ExportOptions = {}) {
    if (!imagesReady(elements)) {
      const copy = snapshot(elements);
      void loadImages(copy).then(() => { if (!this.disposed) this.png(copy, background, state, options); }).catch(() => { if (!this.disposed) this.app.toast('An image could not be loaded for PNG export.', true); });
      return;
    }
    const a = this.app, output = this.pngCanvas(elements, background, state, options);
    output.toBlob(blob => {
      if (this.disposed) return;
      if (blob) { this.download(blob, 'image/png', 'png'); a.toast('PNG exported.'); }
      else a.toast('This drawing is too large to export as PNG. Try SVG instead.', true);
    });
  }
  async load(file?: File) {
    if (!file) return;
    const a = this.app;
    if (file.size > 20 * 1024 * 1024) return a.toast('This file is larger than 20 MB. Try a smaller scene.', true);
    try {
      const raw = JSON.parse(await file.text()); if (this.disposed) return;
      if (raw.type === 'sketchify') {
        const { project, skipped } = readProject(raw);
        a.run(() => {
          if (skipped) { this.pending = { project, name: file.name, result: { elements: project.pages.flatMap(page => page.elements), skipped, appState: {} } }; a.state.importInfo = { skipped, count: this.pending.result.elements.length }; a.openDialog('import'); }
          else { a.workspace.replaceProject(project); a.toast('Project opened.'); }
        });
        return;
      }
      const result = importScene(raw);
      a.run(() => {
        if (result.skipped) { this.pending = { result, name: file.name }; a.state.importInfo = { skipped: result.skipped, count: result.elements.length }; a.openDialog('import'); }
        else this.replace(result, file.name);
      });
    } catch (error) { if (!this.disposed) a.toast(`Could not open drawing: ${error instanceof Error ? error.message : String(error)}`, true); }
  }
  replace(result: ImportResult, name: string) {
    const a = this.app, s = a.state;
    const page = blankPage(); page.elements = result.elements;
    if (typeof result.appState.viewBackgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(result.appState.viewBackgroundColor)) page.background = result.appState.viewBackgroundColor;
    const settings = result.appState.sketchifyLayers;
    if (settings && typeof settings === 'object') page.layers = readProject({ type: 'sketchify', version: 1, pages: [{ ...page, layers: settings as Layers }] }).project.pages[0].layers;
    a.workspace.replaceCanvas(page, name.replace(/\.(excalidraw|json)$/i, '') || 'Untitled');
    for (const element of s.elements) if (element.type === 'text') a.measure(element);
    if (typeof result.appState.viewBackgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(result.appState.viewBackgroundColor)) s.background = result.appState.viewBackgroundColor;
    a.fit(); a.persistence.schedule(); a.toast('Drawing opened.');
  }
  mount() {
    const a = this.app;
    a.listen(a.get('open-file'), 'change', event => { const input = event.target as HTMLInputElement; void this.load(input.files?.[0]); input.value = ''; });
    a.listen(document, 'dragover', event => event.preventDefault());
    a.listen(document, 'drop', event => { if (!event.dataTransfer?.files.length) return; event.preventDefault(); void this.load(event.dataTransfer.files[0]); });
  }
}
