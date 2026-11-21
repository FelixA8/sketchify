export const HANDWRITING_FONT = '"Patrick Hand", cursive';
export const HANDWRITING_FONT_URL = '/fonts/patrick-hand/PatrickHand-Regular.ttf';
export const EXCALIFONT = 'Excalifont, cursive';
export const EXCALIFONT_FACES = [
  ['a88b72a24fb54c9f94e3b5fdaa7481c9', 'U+20-7e,U+a0-a3,U+a5-a6,U+a8-ab,U+ad-b1,U+b4,U+b6-b8,U+ba-ff,U+131,U+152-153,U+2bc,U+2c6,U+2da,U+2dc,U+304,U+308,U+2013-2014,U+2018-201a,U+201c-201e,U+2020,U+2022,U+2024-2026,U+2030,U+2039-203a,U+20ac,U+2122,U+2212'],
  ['be310b9bcd4f1a43f571c46df7809174', 'U+100-130,U+132-137,U+139-149,U+14c-151,U+154-17e,U+192,U+1fc-1ff,U+218-21b,U+237,U+1e80-1e85,U+1ef2-1ef3,U+2113'],
  ['b9dcf9d2e50a1eaf42fc664b50a3fd0d', 'U+400-45f,U+490-491,U+2116'],
  ['41b173a47b57366892116a575a43e2b6', 'U+37e,U+384-38a,U+38c,U+38e-393,U+395-3a1,U+3a3-3a8,U+3aa-3cf,U+3d7'],
  ['3f2c5db56cc93c5a6873b1361d730c16', 'U+2c7,U+2d8-2d9,U+2db,U+2dd,U+302,U+306-307,U+30a-30c,U+326-328,U+212e,U+2211,U+fb01-fb02'],
  ['349fac6ca4700ffec595a7150a0d1e1d', 'U+462-463,U+472-475,U+4d8-4d9,U+4e2-4e3,U+4e6-4e9,U+4ee-4ef'],
  ['623ccf21b21ef6b3a0d87738f77eb071', 'U+300-301,U+303'],
].map(([hash, unicodeRange]) => ({ url: `/fonts/excalifont/Excalifont-Regular-${hash}.woff2`, unicodeRange }));
export const EXCALIFONT_CSS = EXCALIFONT_FACES.map(face => `@font-face{font-family:Excalifont;src:url('${face.url}') format('woff2');font-weight:400;font-style:normal;font-display:swap;unicode-range:${face.unicodeRange};}`).join('');
export const fontFamily = (id: number) => id === 5 ? EXCALIFONT : id === 3 ? 'monospace' : id === 2 ? 'Arial, sans-serif' : HANDWRITING_FONT;

export interface EmbeddedFont { data: string; license: string; family: string; format: 'truetype' | 'woff2'; unicodeRange?: string }
const embeddedFonts = new Map<string, Promise<EmbeddedFont>>();
function embedFont(url: string, licenseURL: string, family: string, format: EmbeddedFont['format'], unicodeRange?: string) {
  const cached = embeddedFonts.get(url); if (cached) return cached;
  const pending = Promise.all([
    fetch(url), fetch(licenseURL),
  ]).then(async ([font, license]) => {
    if (!font.ok || !license.ok) throw new Error('Could not load the handwriting font.');
    const bytes = new Uint8Array(await font.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { data: btoa(binary), license: await license.text(), family, format, unicodeRange };
  }).catch(error => { embeddedFonts.delete(url); throw error; });
  embeddedFonts.set(url, pending); return pending;
}
export function handwritingFontForExport() {
  return embedFont(HANDWRITING_FONT_URL, '/fonts/patrick-hand/OFL.txt', 'Patrick Hand', 'truetype');
}
export function fontsForExport(elements: { type: string; fontFamily: number }[]) {
  const families = new Set(elements.filter(element => element.type === 'text').map(element => element.fontFamily));
  return Promise.all([
    ...(families.has(1) ? [handwritingFontForExport()] : []),
    ...(families.has(5) ? EXCALIFONT_FACES.map(face => embedFont(face.url, '/fonts/excalifont/OFL.txt', 'Excalifont', 'woff2', face.unicodeRange)) : []),
  ]);
}
