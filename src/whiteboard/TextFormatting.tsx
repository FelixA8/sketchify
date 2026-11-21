import { useLayoutEffect, useRef } from 'react';
import { useBoard } from './context';
export function TextFormatting() {
  const { state: s, run } = useBoard(), url = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (s.linkOpen) url.current?.focus();
    run(a => a.text.resize());
    // Reposition after React updates the panel's actual height.
  }, [s.linkOpen, s.zoom, s.pan.x, s.pan.y, run]);
  return <>
    <div id="text-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Edit canvas text" spellCheck={false} tabIndex={0} hidden={!s.editing} />
    <section id="text-formatting" className="surface text-formatting" aria-label="Text formatting" hidden={!s.editing}>
      <div className="text-format-row" role="toolbar" aria-label="Format selected text">{(['bold', 'italic', 'underline'] as const).map((mark, i) => <button key={mark} type="button" className="choice" data-text-format={mark} aria-label={mark[0].toUpperCase() + mark.slice(1)} aria-pressed={!!s.marks[mark]} aria-keyshortcuts={`Control+${['b', 'i', 'u'][i]} Meta+${['b', 'i', 'u'][i]}`} title={`${mark[0].toUpperCase() + mark.slice(1)} (⌘/Ctrl+${['b', 'i', 'u'][i]})`} onClick={() => run(a => a.text.editor.toggle(mark))}>{mark === 'bold' ? <b>B</b> : mark === 'italic' ? <i>I</i> : <u>U</u>}</button>)}
        <button type="button" className="choice" id="text-link-button" aria-label="Add or edit link" aria-expanded={s.linkOpen} title="Link (⌘/Ctrl+k)" onClick={() => run(a => a.state.linkOpen ? a.text.closeLink() : a.text.openLink())}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 4 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" /></svg></button>
        <button type="button" className="choice text-done" id="text-done" onClick={() => run(a => { a.text.finish(); a.canvas.focus(); })}>Done</button>
      </div>
      <form id="text-link-form" className="text-link-form" hidden={!s.linkOpen} onSubmit={event => { event.preventDefault(); run(a => a.text.applyLink()); }}>
        <label htmlFor="text-link-url">Link address</label><input ref={url} id="text-link-url" type="text" inputMode="url" placeholder="https://example.com" autoComplete="off" spellCheck={false} aria-describedby="text-link-error" />
        <span id="text-link-error" role="alert">{s.linkError}</span><a id="text-open-link" href={s.linkURL || undefined} target="_blank" rel="noopener noreferrer" hidden={!s.linkURL}>Open link</a>
        <div className="text-link-actions"><button type="submit" className="choice">Apply</button><button type="button" className="choice" id="text-unlink" onClick={() => run(a => { a.text.editor.apply('link', ''); a.text.closeLink(); })}>Remove link</button><button type="button" className="choice" id="text-link-cancel" onClick={() => run(a => a.text.closeLink())}>Cancel</button></div>
      </form>
    </section>
  </>;
}
