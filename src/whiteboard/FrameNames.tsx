import { useLayoutEffect, useRef } from 'react';
import { rotatePoint, unrotatedBounds } from '../scene';
import { useBoard } from './context';
import { layerModel } from './layers';

export function FrameNames() {
  const { state: s, run } = useBoard(), input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (s.frameEditing) { input.current?.focus({ preventScroll: true }); input.current?.select(); }
  }, [s.frameEditing]);
  const { hidden, locked } = layerModel(s.elements, s.layers);
  return <>{s.elements.filter(element => element.type === 'frame' && !hidden.has(element.id)).map(frame => {
    const box = unrotatedBounds(frame), anchor = rotatePoint({ x: box.x, y: box.y }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, frame.angle);
    const editing = s.frameEditing === frame.id;
    return <div key={frame.id} className="frame-name-anchor" style={{ left: anchor.x * s.zoom + s.pan.x, top: anchor.y * s.zoom + s.pan.y, transform: `rotate(${frame.angle}rad)` }}>
      <div className="frame-name-position" style={{ bottom: 5 * s.zoom, fontSize: `max(var(--frame-name-min-font-size, 0px), ${12 * s.zoom}px)`, opacity: frame.opacity / 100 }}>
        <button type="button" className="frame-name" aria-label={`Rename frame: ${frame.name || 'Frame'}`} title="Rename frame" disabled={locked.has(frame.id)}
          style={{ visibility: editing ? 'hidden' : undefined, color: 'var(--muted)', pointerEvents: s.tool === 'selection' && !s.space && !s.gesture && !locked.has(frame.id) ? 'auto' : 'none' }}
          onClick={() => run(a => a.editFrameName(frame.id))}><span className="frame-name-text">{frame.name || 'Frame'}</span></button>
        {editing && <input ref={input} id="frame-name" className="frame-name-input" aria-label="Frame name" maxLength={100} defaultValue={frame.name || 'Frame'} autoComplete="off" spellCheck={false}
          onBlur={() => run(a => a.finishFrameName())}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault(); run(a => { a.finishFrameName(event.key === 'Escape'); a.canvas.focus({ preventScroll: true }); });
            }
          }} />}
      </div>
    </div>;
  })}</>;
}
