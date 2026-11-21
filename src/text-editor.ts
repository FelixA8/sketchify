import type { Marks, Mark, TextModel, TextSpan } from './types';
type Range = { start: number; end: number };
import { normalizeTextSpans, safeTextLink } from './scene';
import { html, markRange, rangeMarks, replaceRange } from './text';

function readDOM(root: Node) {
  let text = '';
  const spans: TextSpan[] = [];
  function append(value: string, marks: Marks) {
    const start = text.length;
    text += value;
    if (value.length) spans.push({ start, end: text.length, ...marks });
  }
  function visit(raw: Node, inherited: Marks = {}) {
    if (raw.nodeType === 3) { append(raw.nodeValue || '', inherited); return; }
    const node = raw as HTMLElement;
    if (node.nodeType !== 1 && node !== root) return;
    const marks = { ...inherited }, tag = node.tagName;
    if (['SCRIPT', 'STYLE', 'IMG', 'IFRAME'].includes(tag)) return;
    if (['B', 'STRONG'].includes(tag)) marks.bold = true;
    if (['I', 'EM'].includes(tag)) marks.italic = true;
    if (tag === 'U') marks.underline = true;
    const weight = node.style?.fontWeight, italic = node.style?.fontStyle;
    const decoration = node.style?.textDecorationLine || node.style?.textDecoration;
    if (weight) { if (weight === 'bold' || Number(weight) >= 600) marks.bold = true; else if (weight === 'normal' || Number(weight) > 0) delete marks.bold; }
    if (italic) { if (italic === 'italic' || italic.startsWith('oblique')) marks.italic = true; else if (italic === 'normal') delete marks.italic; }
    if (decoration) { if (decoration.includes('underline')) marks.underline = true; else if (decoration === 'none') delete marks.underline; }
    if (tag === 'A' && safeTextLink(node.getAttribute('href'))) marks.link = safeTextLink(node.getAttribute('href'));
    if (tag === 'BR') { if (!node.hasAttribute('data-editor-end')) append('\n', marks); return; }
    const block = node !== root && ['DIV', 'P'].includes(tag);
    if (block && text && !text.endsWith('\n')) append('\n', inherited);
    const emptyBlock = block && node.childNodes.length === 1 && (node.firstChild as HTMLElement).tagName === 'BR';
    if (!emptyBlock) for (const child of node.childNodes) visit(child, marks);
    if (block && node.nextSibling && !text.endsWith('\n')) append('\n', inherited);
  }
  visit(root);
  return { text, textSpans: normalizeTextSpans(text, spans) };
}

class TextEditor {
  root: HTMLElement;
  onChange: () => void;
  onSelection: () => void;
  onLink: () => void;
  model: Required<TextModel>;
  savedSelection: Range;
  pending: Marks | null;
  composition: (Range & { length: number; pending: Marks | null }) | null = null;
  entries: { model: string; selection: Range }[] = [];
  index = -1;
  private abort = new AbortController();
  dispose() { this.abort.abort(); }

  constructor(root: HTMLElement, onChange: () => void, onSelection: () => void, onLink: () => void) {
    this.root = root; this.onChange = onChange; this.onSelection = onSelection; this.onLink = onLink;
    this.model = { text: '', textSpans: [] }; this.savedSelection = { start: 0, end: 0 }; this.pending = null;
    root.addEventListener('compositionstart', () => {
      const selection = this.captureSelection();
      this.composition = { ...selection, length: this.model.text.length, pending: this.pending ? { ...this.pending } : null };
    }, { signal: this.abort.signal });
    root.addEventListener('compositionend', () => {
      this.model = readDOM(root);
      const composition = this.composition;
      this.captureSelection();
      if (composition?.pending) {
        const end = composition.end + this.model.text.length - composition.length;
        for (const key of ['bold', 'italic', 'underline', 'link'] as const) this.model.textSpans = markRange(this.model.text, this.model.textSpans, composition.start, end, key, composition.pending[key]);
        this.render();
      }
      this.composition = null; this.record(); this.onChange(); this.onSelection();
    }, { signal: this.abort.signal });
    root.addEventListener('input', event => {
      this.model = readDOM(root);
      if (!(event as InputEvent).isComposing && !this.composition) { this.captureSelection(); this.record(); }
      this.onChange();
    }, { signal: this.abort.signal });
    root.addEventListener('beforeinput', event => {
      if (event.isComposing) return;
      if (['insertParagraph', 'insertLineBreak'].includes(event.inputType)) { event.preventDefault(); this.insert('\n'); }
      else if (event.inputType === 'insertText' && this.pending) { event.preventDefault(); this.insert(event.data || '', this.pending); }
      else if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); this.undo(event.inputType === 'historyRedo'); }
    }, { signal: this.abort.signal });
    root.addEventListener('keydown', event => {
      if (event.isComposing) return;
      const key = event.key.toLowerCase();
      if (!(event.metaKey || event.ctrlKey)) return;
      const property = ({ b: 'bold', i: 'italic', u: 'underline' } as Record<string, Mark>)[key];
      if (property) { event.preventDefault(); this.toggle(property); }
      else if (key === 'k') { event.preventDefault(); this.onLink(); }
      else if (key === 'z' || key === 'y') { event.preventDefault(); this.undo(key === 'y' || event.shiftKey); }
    }, { signal: this.abort.signal });
    root.addEventListener('paste', event => {
      event.preventDefault(); event.stopPropagation();
      let pasted;
      try {
        const data = JSON.parse(event.clipboardData!.getData('application/x-sketchify-text'));
        if (typeof data.text === 'string') pasted = { text: data.text, textSpans: normalizeTextSpans(data.text, data.textSpans) };
      } catch { /* Other applications provide plain text. */ }
      this.insert(event.clipboardData!.getData('text/plain').replace(/\r\n?/g, '\n'), undefined, pasted);
    }, { signal: this.abort.signal });
    for (const type of ['copy', 'cut'] as const) root.addEventListener(type, event => {
      const { start, end } = this.captureSelection();
      if (start === end) return;
      const text = this.model.text.slice(start, end);
      const textSpans = normalizeTextSpans(text, this.model.textSpans.map(span => ({ ...span, start: span.start - start, end: span.end - start })));
      event.preventDefault(); event.stopPropagation();
      event.clipboardData!.setData('text/plain', text);
      event.clipboardData!.setData('text/html', html({ text, textSpans }));
      event.clipboardData!.setData('application/x-sketchify-text', JSON.stringify({ text, textSpans }));
      if (type === 'cut') this.insert('');
    }, { signal: this.abort.signal });
    root.addEventListener('click', event => { if ((event.target as HTMLElement).closest('a')) event.preventDefault(); }, { signal: this.abort.signal });
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === root) { this.captureSelection(); this.onSelection(); }
    }, { signal: this.abort.signal });
  }
  load(element: TextModel) {
    this.model = { text: element.text, textSpans: normalizeTextSpans(element.text, element.textSpans) };
    this.pending = null; this.savedSelection = { start: element.text.length, end: element.text.length };
    this.entries = []; this.index = -1; this.record(); this.render();
  }
  captureSelection() {
    const selection = document.getSelection();
    if (!selection?.rangeCount || !this.root.contains(selection.anchorNode) || !this.root.contains(selection.focusNode)) return this.savedSelection;
    const range = selection.getRangeAt(0);
    const offset = (node: Node, position: number) => {
      const prefix = document.createRange();
      prefix.selectNodeContents(this.root); prefix.setEnd(node, position);
      return readDOM(prefix.cloneContents()).text.length;
    };
    const next = { start: offset(range.startContainer, range.startOffset), end: offset(range.endContainer, range.endOffset) };
    if (next.start !== this.savedSelection.start || next.end !== this.savedSelection.end) this.pending = null;
    this.savedSelection = next;
    return next;
  }
  select(start: number, end = start) {
    const walker = document.createTreeWalker(this.root, 4), nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const locate = (offset: number): [Node, number] => {
      for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length; }
      return [this.root, this.root.childNodes.length ? this.root.childNodes.length - 1 : 0];
    };
    const range = document.createRange();
    range.setStart(...locate(start)); range.setEnd(...locate(end));
    const selection = document.getSelection(); selection!.removeAllRanges(); selection!.addRange(range);
    this.savedSelection = { start, end };
  }
  render() {
    this.root.innerHTML = html(this.model) + '<br data-editor-end="true">';
    this.select(this.savedSelection.start, this.savedSelection.end);
  }
  activeMarks() {
    const { start, end } = this.captureSelection();
    return this.pending || rangeMarks(this.model.text, this.model.textSpans, start, end);
  }
  toggle(property: Mark) {
    const marks = this.activeMarks();
    this.apply(property, !marks[property]);
  }
  apply(property: Mark, value: string | boolean) {
    const { start, end } = this.captureSelection();
    if (start === end) {
      this.pending = { ...this.activeMarks(), [property]: value };
    } else {
      this.model.textSpans = markRange(this.model.text, this.model.textSpans, start, end, property, value);
      this.record(); this.render(); this.onChange();
    }
    this.root.focus({ preventScroll: true }); this.select(start, end); this.onSelection();
  }
  insert(value: string, marks?: Marks, rich?: TextModel) {
    const { start, end } = this.captureSelection();
    const inserted = rich?.text ?? value;
    this.model = replaceRange(this.model, start, end, inserted, rich ? {} : marks ?? this.pending ?? undefined);
    if (rich) this.model.textSpans = normalizeTextSpans(this.model.text, [...this.model.textSpans, ...(rich.textSpans || []).map(span => ({ ...span, start: span.start + start, end: span.end + start }))]);
    this.savedSelection = { start: start + inserted.length, end: start + inserted.length };
    this.render(); this.record(); this.onChange(); this.onSelection();
  }
  record() {
    const snapshot = JSON.stringify(this.model);
    if (snapshot === this.entries?.[this.index]?.model) return;
    this.entries.splice(this.index + 1);
    this.entries.push({ model: snapshot, selection: { ...this.savedSelection } });
    if (this.entries.length > 100) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  undo(redo = false) {
    this.index = Math.max(0, Math.min(this.entries.length - 1, this.index + (redo ? 1 : -1)));
    const entry = this.entries[this.index];
    this.model = JSON.parse(entry.model); this.savedSelection = { ...entry.selection }; this.pending = null;
    this.render(); this.onChange(); this.onSelection();
  }
}
export { TextEditor, readDOM };
