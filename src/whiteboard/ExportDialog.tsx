import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBoard } from './context';
import { Icon } from './Icon';
import { exportDimensions } from './files';
import { visibleElements } from './layers';
import { selectionWithChildren } from './object-actions';
import { imagesReady, loadImages } from '../images';
import { ExportScope } from './ExportScope';

export function ExportDialog() {
  const { state: s, run } = useBoard();
  const [scale, setScale] = useState(2), [dark, setDark] = useState(s.theme === 'dark');
  const [background, setBackground] = useState(true), [selected, setSelected] = useState(false);
  const [copying, setCopying] = useState(false), [feedback, setFeedback] = useState(false);
  const preview = useRef<HTMLDivElement>(null), backgroundInput = useRef<HTMLInputElement>(null);
  const elements = useMemo(() => visibleElements(selected ? selectionWithChildren(s.elements, s.selected) : s.elements, s.layers, s.elements), [s.elements, s.layers, s.selected, selected]);
  const dimensions = exportDimensions(elements, scale);

  useLayoutEffect(() => {
    let active = true;
    const status = (message: string) => {
      const paragraph = document.createElement('p'); paragraph.setAttribute('role', 'status'); paragraph.textContent = message;
      preview.current?.replaceChildren(paragraph);
    };
    const paint = () => {
      if (!active || !elements.length) return;
      try {
        run(a => {
          const canvas = a.files.pngCanvas(elements, background, a.state, { scale, dark, maxDimension: 1200 });
          canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Export preview');
          preview.current?.replaceChildren(canvas);
        });
      } catch { status('Preview unavailable. Try exporting as SVG.'); }
    };
    if (elements.length && !imagesReady(elements)) {
      status('Loading preview…');
      void loadImages(elements).then(paint).catch(() => { if (active) status('An image could not be loaded. Try again after reopening the drawing.'); });
    } else paint();
    document.fonts?.addEventListener?.('loadingdone', paint);
    return () => { active = false; document.fonts?.removeEventListener?.('loadingdone', paint); };
  }, [elements, background, dark, scale, s.background, run]);

  const exportImage = (format: string) => {
    setFeedback(true);
    run(a => a.files.export(format, selected, backgroundInput.current!.checked, { scale, dark }));
  };
  const copyImage = () => {
    setFeedback(true); setCopying(true);
    run(a => { void a.files.copyImage(selected, backgroundInput.current!.checked, { scale, dark }).finally(() => setCopying(false)); });
  };
  return <div className="export-layout">
    <figure className="export-figure">
      <div className="export-preview" data-dark={dark}>
        <div ref={preview} className="export-preview-image" hidden={!elements.length} />
        {!elements.length && <p role="status">No visible elements. Show a layer or choose another scope.</p>}
      </div>
      <figcaption id="export-dimensions" aria-live="polite">{elements.length ? `${dimensions.width} × ${dimensions.height} px · PNG & clipboard` : 'Nothing to export'}{elements.length > 0 && dimensions.limited && <span>PNG limited to 8192 px on its longest side. SVG keeps the selected scale.</span>}</figcaption>
    </figure>
    <div className="export-settings">
      <div className="field-label export-scope"><span id="export-scope-label">Include</span><ExportScope selected={selected} hasSelection={s.selected.size > 0} onChange={value => { setSelected(value); setFeedback(false); }} /></div>
      <label className="export-toggle" htmlFor="export-background"><span>Background</span><input ref={backgroundInput} id="export-background" type="checkbox" role="switch" checked={background} onChange={event => { setBackground(event.target.checked); setFeedback(false); }} /><span className="export-toggle-track" aria-hidden="true"><span /></span></label>
      <label className="export-toggle" htmlFor="export-dark"><span>Dark mode</span><input id="export-dark" type="checkbox" role="switch" checked={dark} onChange={event => { setDark(event.target.checked); setFeedback(false); }} /><span className="export-toggle-track" aria-hidden="true"><span /></span></label>
      <div className="export-scale-row"><span id="export-scale-label">Scale</span><div className="export-scale" role="group" aria-labelledby="export-scale-label">{[1, 2, 3].map(value => <button key={value} type="button" data-scale={value} aria-pressed={scale === value} onClick={() => { setScale(value); setFeedback(false); }}>{value}×</button>)}</div></div>
      <div className="export-formats" aria-describedby="export-dimensions">
        <button className="export-primary" data-export="png" disabled={!elements.length || copying} onClick={() => exportImage('png')}><Icon name="download" />PNG</button>
        <button className="export-primary" data-export="svg" disabled={!elements.length || copying} onClick={() => exportImage('svg')}><Icon name="download" />SVG</button>
        <button className="export-primary export-copy" data-export="clipboard" disabled={!elements.length || copying} onClick={copyImage}><Icon name="duplicate" />{copying ? 'Copying…' : 'Copy to clipboard'}</button>
      </div>
      <p className="export-feedback" role="status" aria-live="polite" data-error={!copying && feedback && s.toast?.error}>{copying ? 'Copying PNG…' : feedback ? s.toast?.message : ''}</p>
      <button className="export-editable" data-export="json" onClick={() => exportImage('json')}>Save editable page (.excalidraw)</button>
    </div>
  </div>;
}
