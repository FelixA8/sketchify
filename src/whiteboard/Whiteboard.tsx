'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { createStore, initialState } from './store';
import { Controller } from './controller';
import { mountCanvas } from './canvas';
import { BoardContext, useBoard } from './context';
import { Chrome } from './Chrome';
import { Properties } from './Properties';
import { Menu } from './Panels';
import { Dialog } from './Dialog';
import { TextFormatting } from './TextFormatting';
import { ContextMenu } from './ContextMenu';
import { CanvasOverview } from './CanvasOverview';
import { FrameNames } from './FrameNames';
import { applyAppearance } from '../appearance';
import { projectNameLabel } from './project-name';
import { Workspace } from './Workspace';
function Surface() {
  const { state: s } = useBoard();
  const cursor = s.gesture?.kind === 'pan' || s.gesture?.kind === 'rotate' ? 'grabbing' : s.space || s.tool === 'hand' ? 'grab' : s.tool === 'selection' ? s.cursor || 'default' : s.tool === 'text' ? 'text' : s.tool === 'eraser' ? 'cell' : 'crosshair';
  useLayoutEffect(() => {
    if (!s.restored) return;
    applyAppearance(s.theme, s.background);
    document.title = `${projectNameLabel(s.name)} | Local whiteboard`;
    const root = document.documentElement;
    for (const name of root.getAttributeNames()) if (name.startsWith('data-startup')) root.removeAttribute(name);
  }, [s.restored, s.theme, s.background, s.name]);
  return <>
    <canvas id="canvas" tabIndex={0} style={{ cursor }} aria-label="Drawing canvas. Choose a drawing tool, then drag. Press question mark for keyboard shortcuts." />
    <div id="connector-center-hint" aria-hidden="true" hidden={!s.connectorHint || !s.preferences.arrowBinding} style={s.connectorHint ? { left: s.connectorHint.x * s.zoom + s.pan.x, top: s.connectorHint.y * s.zoom + s.pan.y } : undefined} />
    <FrameNames /><Chrome /><Properties /><Menu /><CanvasOverview /><Workspace /><TextFormatting /><ContextMenu /><Dialog />
    <div id="toast" className={`toast${s.toast?.error ? ' error' : ''}`} role="status" aria-live="polite" hidden={!s.toast}>{s.toast?.message}</div>
    <input id="open-file" type="file" accept=".sketchify,.excalidraw,.json,application/json" hidden />
  </>;
}
export default function Whiteboard() {
  const [store] = useState(() => createStore(initialState()));
  const controller = useRef<Controller | null>(null), root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const app = new Controller(store, root.current!); controller.current = app; app.mount();
    const disposeCanvas = mountCanvas(app.canvas, store);
    return () => { disposeCanvas(); app.dispose(); controller.current = null; };
  }, [store]);
  return <BoardContext.Provider value={{ store, controller }}><BoardRoot root={root}><Surface /></BoardRoot></BoardContext.Provider>;
}
function BoardRoot({ root, children }: { root: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const { state: s } = useBoard();
  return <main ref={root} id="app" data-panel-size={s.iconTextSize} aria-label="Sketchify whiteboard">{children}</main>;
}
