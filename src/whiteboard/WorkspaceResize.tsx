import { useLayoutEffect, useRef, useState } from 'react';
import { useBoard } from './context';

function dimensions(handle: HTMLElement) {
  const panel = handle.parentElement!, rect = panel.getBoundingClientRect();
  const parent = panel.parentElement!, inset = rect.left - parent.getBoundingClientRect().left;
  return {
    width: rect.width,
    min: Number.parseFloat(window.getComputedStyle(panel).minWidth) || 168,
    max: parent.clientWidth - inset * 2,
  };
}

export function WorkspaceResize() {
  const { state: s, run } = useBoard();
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; x: number; width: number; previous: number | null } | null>(null);
  const [resizing, setResizing] = useState(false);
  const [size, setSize] = useState({ width: 168, min: 168, max: 168 });
  useLayoutEffect(() => {
    const element = handle.current!;
    if (!s.sidebar || s.preferences.zenMode) return;
    const measure = () => {
      const next = dimensions(element);
      setSize(previous => previous.width === next.width && previous.min === next.min && previous.max === next.max ? previous : next);
    };
    measure();
    const observer = window.ResizeObserver ? new window.ResizeObserver(measure) : null;
    observer?.observe(element.parentElement!);
    observer?.observe(element.parentElement!.parentElement!);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [s.sidebar, s.preferences.zenMode, s.iconTextSize]);
  const save = (width: number | null) => run(a => { a.state.sidebarWidth = width; a.persistence.schedule(); });
  const resize = (width: number) => {
    const { min, max } = dimensions(handle.current!);
    save(Math.round(Math.min(max, Math.max(min, width))));
  };
  const finish = (cancel = false) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    setResizing(false);
    if (cancel) save(active.previous);
    if (handle.current?.hasPointerCapture(active.pointer)) handle.current.releasePointerCapture(active.pointer);
  };
  return <div ref={handle} className="workspace-resize" role="separator" tabIndex={0}
    aria-label="Resize pages and layers" aria-orientation="vertical" aria-controls="workspace"
    aria-valuemin={Math.round(size.min)} aria-valuemax={Math.round(size.max)} aria-valuenow={Math.round(size.width)}
    aria-valuetext={`${Math.round(size.width)} pixels`} data-resizing={resizing}
    title="Drag to resize. Double-click to reset. Left and right arrows adjust width."
    onPointerDown={event => {
      if (event.button !== 0 || drag.current) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointer: event.pointerId, x: event.clientX, width: dimensions(event.currentTarget).width, previous: s.sidebarWidth };
      setResizing(true);
    }}
    onPointerMove={event => {
      const active = drag.current;
      if (!active || active.pointer !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      resize(active.width + event.clientX - active.x);
    }}
    onPointerUp={event => { if (drag.current?.pointer === event.pointerId) finish(); }}
    onPointerCancel={event => { if (drag.current?.pointer === event.pointerId) finish(true); }}
    onLostPointerCapture={() => finish()}
    onDoubleClick={() => { finish(); save(null); }}
    onKeyDown={event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); finish(true); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); event.stopPropagation();
        resize(dimensions(event.currentTarget).width + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 40 : 10));
      } else if (event.key === 'Home' || event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); save(null); }
      else if (event.key === 'End') { event.preventDefault(); event.stopPropagation(); resize(dimensions(event.currentTarget).max); }
    }} />;
}
