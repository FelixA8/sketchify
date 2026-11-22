import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Element, Style } from '../types';
import { selectedElements } from './canvas';
import { useBoard } from './context';
import { Icon, Sloppiness, StrokeWidth } from './Icon';
import { HANDWRITING_FONT, EXCALIFONT } from '../fonts';
import { layerModel } from './layers';
import { NOTE_COLORS } from '../notes';
function Section({ label, children }: { label: string; children: ReactNode }) { return <div className="prop-section"><span className="prop-label">{label}</span>{children}</div>; }
function Swatches({ property, colors, value }: { property: 'strokeColor' | 'backgroundColor'; colors: string[]; value: string }) {
  const { run } = useBoard();
  return <div className="swatches">{colors.map(color => <button key={color} className={`swatch ${color === 'transparent' ? 'transparent' : ''}`} style={{ '--color': color } as CSSProperties} data-prop={property} data-value={color} aria-label={`${property === 'strokeColor' ? 'Stroke' : 'Fill'} ${color}`} aria-pressed={color === value} onClick={() => run(a => a.applyStyle(property, color))} />)}<input key={value} type="color" data-color={property} aria-label={`Custom ${property === 'strokeColor' ? 'stroke' : 'fill'} color`} defaultValue={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} /></div>;
}
function Choices({ property, items, value }: { property: keyof Style | 'rectangleEdges'; items: [string | number, string, ReactNode][]; value: unknown }) {
  const { run } = useBoard();
  return <div className="prop-row">{items.map(([v, label, content]) => <button key={v} className={`choice${property === 'rectangleEdges' ? ' edge-choice' : ''}`} data-prop={property} data-value={v} aria-label={label} title={label} aria-pressed={String(value) === String(v)} onClick={() => run(a => {
    if (property === 'rectangleEdges') {
      if (value !== v) a.applyStyle('roundness', v === 'rounded' ? { type: 3, value: 32 } : null);
    } else a.applyStyle(property, v);
  })}>{content}</button>)}</div>;
}
function TextAlignment({ targets, rectangle }: { targets: Element[]; rectangle: boolean }) {
  const { state: s, run } = useBoard();
  const values = targets.length ? targets : [s.style];
  const horizontal = values.map(element => element.textAlign ?? (rectangle ? 'center' : 'left'));
  const vertical = targets.map(element => element.verticalAlign ?? 'middle');
  const disabled = targets.length > 0 && targets.every(element => layerModel(s.elements, s.layers).locked.has(element.id));
  return <Section label="Text align"><div className="text-alignment">
    <div className="prop-row" role="group" aria-label="Horizontal text alignment">{(['left', 'center', 'right'] as const).map(value => <button key={value} type="button" className="choice" data-prop="textAlign" data-value={value} aria-label={`Align text ${value}`} title={`Align text ${value}`} aria-pressed={horizontal.every(current => current === value)} disabled={disabled} onClick={() => run(a => a.setTextAlignment('textAlign', value))}><Icon name={`align${value[0].toUpperCase()}${value.slice(1)}`} /></button>)}</div>
    {rectangle && <div className="prop-row" role="group" aria-label="Vertical text alignment">{(['top', 'middle', 'bottom'] as const).map(value => <button key={value} type="button" className="choice" data-prop="verticalAlign" data-value={value} aria-label={`Align text ${value}`} title={`Align text ${value}`} aria-pressed={vertical.every(current => current === value)} disabled={disabled} onClick={() => run(a => a.setTextAlignment('verticalAlign', value))}><Icon name={`align${value[0].toUpperCase()}${value.slice(1)}`} /></button>)}</div>}
  </div></Section>;
}
function CornerRounding({ value }: { value: number | undefined }) {
  const { run } = useBoard();
  const [draft, setDraft] = useState<string | null>(null);
  const limit = Math.max(100, value ?? 0);
  const clamp = (input: number) => Math.max(0, Math.min(limit, Math.round(input)));
  return <Section label="Corner rounding"><div className="corner-rounding">
    <input id="corner-rounding" type="range" min="0" max={limit} step="1" value={value ?? 0} aria-label="Corner rounding" aria-valuetext={value === undefined ? 'Mixed' : `${value} pixels`} style={{ '--rounding-fill': `${(value ?? 0) / limit * 100}%` } as CSSProperties} onChange={() => {}} />
    <input type="number" min="0" max={limit} step="1" aria-label="Corner rounding in pixels" placeholder={value === undefined ? 'Mixed' : undefined} value={draft ?? value ?? ''} onChange={event => {
      const input = event.currentTarget.value; setDraft(input);
      if (input !== '' && Number.isFinite(Number(input))) {
        const radius = clamp(Number(input));
        run(a => a.applyStyle('roundness', { type: 3, value: radius }, false));
      }
    }} onBlur={() => {
      if (draft !== null) {
        run(a => a.commit()); setDraft(null);
      }
    }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
  </div></Section>;
}
export function Properties() {
  const { state: s, run } = useBoard(), selected = selectedElements(s);
  const show = !s.preferences.zenMode && s.panel && !['hand', 'eraser', 'frame'].includes(s.tool) && (!!s.editing || s.tool !== 'selection' || selected.length > 0);
  const noteParent = s.editing?.container?.type === 'stickynote' ? s.editing.container : selected.find(element => element.type === 'stickynote') ?? s.elements.find(element => element.type === 'stickynote' && selected.some(text => text.containerId === element.id));
  const notes = s.tool === 'stickynote' || !!noteParent && (!!s.editing || selected.every(element => element.type === 'stickynote' || element.type === 'text' && s.elements.some(parent => parent.type === 'stickynote' && parent.id === element.containerId)));
  const style = notes ? noteParent ?? s.noteStyle : s.editing?.element || selected[0] || s.style;
  const text = !!s.editing || (selected.length ? selected.every(e => e.type === 'text') : s.tool === 'text');
  const images = selected.length > 0 && selected.every(e => e.type === 'image');
  const rectangles = selected.filter(e => e.type === 'rectangle');
  const modes = rectangles.length ? rectangles.map(e => e.roundness ? 'rounded' : 'sharp') : [s.style.roundness ? 'rounded' : 'sharp'];
  const mode = modes.every(v => v === modes[0]) ? modes[0] : undefined;
  const rounding = rectangles.length ? rectangles.map(e => !e.roundness ? 0 : e.roundness.type === 3 ? e.roundness.value ?? 32 : Math.min(Math.abs(e.width), Math.abs(e.height)) / 4) : [s.style.roundness?.value ?? (s.style.roundness ? 32 : 0)];
  const radius = rounding.every(v => v === rounding[0]) ? rounding[0] : undefined;
  const alignmentSelection = s.editing ? [s.editing.element] : selected;
  const alignmentTargets = alignmentSelection.map(element => ['rectangle', 'stickynote'].includes(element.type) ? s.elements.find(text => text.type === 'text' && text.containerId === element.id) ?? element : element);
  const rectangleText = alignmentSelection.length > 0 && alignmentSelection.every(element => ['rectangle', 'stickynote'].includes(element.type) || element.type === 'text' && (['rectangle', 'stickynote'].includes(s.editing?.container?.type ?? '') || s.elements.some(parent => parent.id === element.containerId && ['rectangle', 'stickynote'].includes(parent.type))));
  const standaloneText = alignmentSelection.length ? alignmentSelection.every(element => element.type === 'text' && !element.containerId) : s.tool === 'text';
  return <section id="properties" className="surface properties" aria-label="Shape properties" hidden={!show}>
    {!images && <Section label={notes ? 'Text color' : 'Stroke'}><Swatches property="strokeColor" colors={['#1b1b1f', '#c92a2a', '#2b8a3e', '#1971c2', '#e67700']} value={style.strokeColor} /></Section>}
    {notes && <Section label="Note color"><Swatches property="backgroundColor" colors={[...NOTE_COLORS]} value={style.backgroundColor} /></Section>}
    {!images && (!text && !notes ? <>
      <Section label="Background"><Swatches property="backgroundColor" colors={['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99']} value={style.backgroundColor} /></Section>
      {style.backgroundColor !== 'transparent' && <Section label="Fill"><Choices property="fillStyle" items={[[ 'hachure', 'Hachure', '╱╱'], ['cross-hatch', 'Cross hatch', '╳'], ['solid', 'Solid', '■']]} value={style.fillStyle} /></Section>}
      <Section label="Stroke width"><Choices property="strokeWidth" items={[[1, 'Thin', <StrokeWidth key="thin" value={1} />], [2, 'Medium', <StrokeWidth key="medium" value={2} />], [4, 'Thick', <StrokeWidth key="thick" value={4} />]]} value={style.strokeWidth} /></Section>
      <Section label="Stroke style"><Choices property="strokeStyle" items={[[ 'solid', 'Solid stroke', '━'], ['dashed', 'Dashed stroke', '╍╍'], ['dotted', 'Dotted stroke', '···']]} value={style.strokeStyle} /></Section>
      <Section label="Sloppiness"><Choices property="roughness" items={[[0, 'Architect', <Sloppiness key="0" value={0} />], [1, 'Artist', <Sloppiness key="1" value={1} />], [2, 'Cartoonist', <Sloppiness key="2" value={2} />]]} value={style.roughness} /></Section>
      {(rectangles.length > 0 || !selected.length && s.tool === 'rectangle') && <>
        <Section label="Edges"><Choices property="rectangleEdges" items={[[ 'sharp', 'Sharp corners', <Icon key="sharp" name="edgeSharp" />], ['rounded', 'Rounded corners', <Icon key="rounded" name="edgeRounded" />]]} value={mode} /></Section>
        {mode === 'rounded' && <CornerRounding key={rectangles.map(e => e.id).join(',')} value={radius} />}
      </>}
    </> : <>
      <Section label="Font size"><Choices property="fontSize" items={[[16, 'Small', 'S'], [32, 'Medium', 'M'], [36, 'Large', 'L'], [48, 'Extra large', 'XL']]} value={style.fontSize} /></Section>
      <Section label="Font family"><Choices property="fontFamily" items={[[1, 'Hand drawn', <span key="1" style={{ fontFamily: HANDWRITING_FONT }}>Aa</span>], [5, 'Excalifont', <span key="5" style={{ fontFamily: EXCALIFONT }}>Aa</span>], [2, 'Normal', 'Aa'], [3, 'Code', <span key="3" style={{ fontFamily: 'monospace' }}>Aa</span>]]} value={style.fontFamily} /></Section>
    </>)}
    {(standaloneText || rectangleText) && <TextAlignment targets={alignmentTargets} rectangle={rectangleText} />}
    <Section label="Opacity"><div className="range-row"><input type="range" min="10" max="100" value={style.opacity} id="opacity" aria-label="Opacity" onChange={() => {}} /><output id="opacity-output">{style.opacity}</output></div></Section>
    {!!selected.length && <><Section label="Layers"><div className="prop-row">{[['back', 'Send to back'], ['front', 'Bring to front']].map(([action, label]) => <button key={action} className="choice" data-action={action} aria-label={label} title={label} onClick={() => run(a => a.action(action))}><Icon name={action} /></button>)}</div></Section><div className="properties-footer">{[['duplicate', 'Duplicate selection', 'duplicate', 'Duplicate'], ['delete', 'Delete selection', 'trash', 'Delete']].map(([action, label, icon, title]) => <button key={action} className="choice" data-action={action} aria-label={label} title={title} onClick={() => run(a => a.action(action))}><Icon name={icon} /></button>)}</div></>}
  </section>;
}
