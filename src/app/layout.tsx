import type { Metadata, Viewport } from 'next';
import '../style.css';
import { HANDWRITING_FONT_URL, EXCALIFONT_CSS } from '../fonts';
import { appearanceBootstrap } from '../appearance';
export const metadata: Metadata = {
  title: 'Sketchify | Local whiteboard',
  description: 'Sketchify is a browser whiteboard with a friendly UI for sketching hand-drawn diagrams and saving your work on your device.',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '16x16 32x32 48x48' }, { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' }],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script id="canvas-appearance" dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /><link rel="preload" href={HANDWRITING_FONT_URL} as="font" type="font/ttf" crossOrigin="anonymous" /><style>{EXCALIFONT_CSS}</style></head><body>{children}</body></html>;
}
