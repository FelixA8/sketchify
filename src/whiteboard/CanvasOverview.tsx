import { useLayoutEffect, useMemo, useRef } from 'react';
import { sceneBounds, unrotatedBounds } from '../scene';
import type { Element } from '../types';
import { subscribeImages } from '../images';
import { useBoard } from './context';
import { drawElement } from './canvas';
import { Icon } from './Icon';
import { storedScene } from './persistence';
import type { State } from './store';
import { version } from '../../package.json';
import { visibleElements } from './layers';

const number = (value: number) => String(Math.round(value * 100) / 100);
const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
function bytes(size: number) {
  return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
}
function Measurements({ elements, scene = false }: { elements: Element[]; scene?: boolean }) {
  const box = !scene && elements.length === 1 ? unrotatedBounds(elements[0]) : sceneBounds(elements);
  return <dl className="canvas-measurements"><dt>Width</dt><dd>{number(box.width)}</dd><dt>Height</dt><dd>{number(box.height)}</dd></dl>;
}
export function CanvasProperties() {
  const { state: s, run } = useBoard();
  const selected = s.elements.filter(element => s.selected.has(element.id));
  const sceneSize = useMemo(() => byteSize(s.elements), [s.elements]);
  const totalSize = byteSize(storedScene(s));
  return <section id="canvas-properties" className="surface canvas-properties" aria-label="Canvas and shape properties">
    <div className="overview-head"><h2>Properties</h2><button className="icon-button" aria-label="Close canvas properties" onClick={() => run(a => { a.togglePreference('canvasProperties'); a.canvas.focus(); })}><Icon name="close" /></button></div>
    <details open><summary>General</summary>
      <h3>Version</h3><p className="canvas-version">Sketchify {version}</p>
      <h3>Storage</h3><dl className="canvas-measurements"><dt>Scene</dt><dd>{bytes(sceneSize)}</dd><dt>Total</dt><dd>{bytes(totalSize)}</dd></dl>
      <h3>Scene</h3><dl className="canvas-measurements"><dt>Shapes</dt><dd>{s.elements.length}</dd></dl>
      <Measurements elements={s.elements} scene />
    </details>
    <details open className="selection-measurements"><summary>{selected.length > 1 ? 'Selection' : 'Shape'}</summary>
      {selected.length ? <>
        <dl className="canvas-measurements">{selected.length === 1 ? <><dt>Type</dt><dd className="shape-type">{selected[0].type}</dd><dt>X</dt><dd>{number(selected[0].x)}</dd><dt>Y</dt><dd>{number(selected[0].y)}</dd></> : <><dt>Shapes</dt><dd>{selected.length}</dd></>}</dl>
        <Measurements elements={selected} />
        {selected.length === 1 && <dl className="canvas-measurements"><dt>Angle</dt><dd>{number(selected[0].angle * 180 / Math.PI)}°</dd></dl>}
      </> : <p className="overview-empty">Select a shape to see its properties.</p>}
    </details>
  </section>;
}

export function minimapGeometry(state: State, width: number, height: number) {
  const viewport = { x: -state.pan.x / state.zoom, y: -state.pan.y / state.zoom, width: width / state.zoom, height: height / state.zoom };
  const visible = visibleElements(state.elements, state.layers);
  const scene = visible.length ? sceneBounds(visible) : viewport;
  const x = Math.min(scene.x, viewport.x), y = Math.min(scene.y, viewport.y);
  const w = Math.max(scene.x + scene.width, viewport.x + viewport.width) - x;
  const h = Math.max(scene.y + scene.height, viewport.y + viewport.height) - y;
  const scale = Math.min(196 / Math.max(w, 1), 104 / Math.max(h, 1));
  return { viewport, scale, x: 110 - (x + w / 2) * scale, y: 64 - (y + h / 2) * scale };
}
export function Minimap() {
  const { state: s, run } = useBoard(), canvas = useRef<HTMLCanvasElement>(null);
  const geometry = useRef<ReturnType<typeof minimapGeometry> | null>(null);
  const dragGeometry = useRef<ReturnType<typeof minimapGeometry> | null>(null);
  useLayoutEffect(() => {
    const paint = () => {
      const map = canvas.current!, main = document.getElementById('canvas')!;
      const g = minimapGeometry(s, main.clientWidth, main.clientHeight); geometry.current = g;
      const ctx = map.getContext('2d')!;
      ctx.clearRect(0, 0, 220, 128);
      ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.scale, g.scale);
      for (const element of visibleElements(s.elements, s.layers)) drawElement(element, ctx, s);
      ctx.fillStyle = s.theme === 'dark' ? '#b4afff20' : '#5753c910';
      ctx.strokeStyle = s.theme === 'dark' ? '#b4afff' : '#5753c9'; ctx.lineWidth = 1.5 / g.scale;
      const v = g.viewport; ctx.fillRect(v.x, v.y, v.width, v.height); ctx.strokeRect(v.x, v.y, v.width, v.height);
      ctx.restore();
    };
    paint();
    window.addEventListener('resize', paint);
    const unsubscribe = subscribeImages(paint);
    return () => { window.removeEventListener('resize', paint); unsubscribe(); };
  }, [s]);
  const navigate = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const g = dragGeometry.current ?? geometry.current; if (!g) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * 220 / rect.width - g.x) / g.scale;
    const y = ((event.clientY - rect.top) * 128 / rect.height - g.y) / g.scale;
    run(a => { a.text.finish(); a.state.pan = { x: a.width / 2 - x * a.state.zoom, y: a.height / 2 - y * a.state.zoom }; a.persistence.schedule(); });
  };
  return <section id="minimap" className="surface minimap" aria-label="Minimap">
    <div className="overview-head"><h2>Minimap</h2><button className="icon-button" aria-label="Close minimap" onClick={() => run(a => { a.togglePreference('minimap'); a.canvas.focus(); })}><Icon name="close" /></button></div>
    <canvas ref={canvas} width={220} height={128} tabIndex={0} role="button" aria-label="Navigate canvas with minimap" aria-describedby="minimap-help" onPointerDown={event => { if (event.button !== 0) return; dragGeometry.current = geometry.current; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); navigate(event); }} onPointerMove={event => { if (event.buttons === 1 && dragGeometry.current) navigate(event); }} onPointerUp={() => { dragGeometry.current = null; }} onPointerCancel={() => { dragGeometry.current = null; }} onLostPointerCapture={() => { dragGeometry.current = null; }} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      run(a => {
        a.cancelLayerNavigation();
        if (['Home', 'Enter', ' '].includes(event.key)) a.fit();
        else { a.state.pan.x += event.key === 'ArrowLeft' ? a.width / 4 : event.key === 'ArrowRight' ? -a.width / 4 : 0; a.state.pan.y += event.key === 'ArrowUp' ? a.height / 4 : event.key === 'ArrowDown' ? -a.height / 4 : 0; a.persistence.schedule(); }
      });
    }} />
    <span id="minimap-help" className="sr-only">Click or drag to navigate. Arrow keys pan; Home fits the drawing.</span>
  </section>;
}
export function CanvasOverview() {
  const { state: s } = useBoard();
  if (s.preferences.zenMode || !s.preferences.minimap && !s.preferences.canvasProperties) return null;
  return <aside className="canvas-overview" aria-label="Canvas overview">{s.preferences.canvasProperties && <CanvasProperties />}{s.preferences.minimap && <Minimap />}</aside>;
}
