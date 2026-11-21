import type { Tool } from '../types';
export const tools: [Tool, string, string, string][] = [
  ['selection', 'Selection', '1', 'v'], ['hand', 'Hand', '2', 'h'], ['rectangle', 'Rectangle', '3', 'r'],
  ['diamond', 'Diamond', '4', 'd'], ['ellipse', 'Ellipse', '5', 'o'], ['arrow', 'Arrow', '6', 'a'],
  ['line', 'Line', '7', 'l'], ['freedraw', 'Draw', '8', 'p'], ['text', 'Text', '9', 't'], ['stickynote', 'Sticky note', '', 'n'], ['eraser', 'Eraser', '0', 'e'],
];
export const hints: Record<Tool, string> = {
  selection: 'To move canvas, hold spacebar or use the hand tool', hand: 'Drag to move around the canvas',
  rectangle: 'Click and drag to draw a rectangle. Hold Shift for a square.', ellipse: 'Click and drag to draw an ellipse. Hold Shift for a circle.',
  diamond: 'Click and drag to draw a diamond.', arrow: 'Click and drag to draw an arrow. Hold Shift to snap its angle.',
  line: 'Click and drag to draw a line. Hold Shift to snap its angle.', freedraw: 'Draw freely. Release to finish your stroke.',
  text: 'Click anywhere to add text. Double-click existing text to edit.', eraser: 'Drag over shapes to erase them.',
  stickynote: 'Click to place a note, or drag to size it. Double-click a note to edit its text.',
};
