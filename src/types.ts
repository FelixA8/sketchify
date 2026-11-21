export type Tool = 'selection' | 'hand' | 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text' | 'stickynote' | 'eraser';
export interface Point { x: number; y: number }
export interface Box extends Point { width: number; height: number }
export interface Roundness { type: number; value?: number }
export interface EndpointBinding { elementId: string; fixedPoint?: [number, number]; focus: number; gap: number }
export interface Marks { bold?: boolean; italic?: boolean; underline?: boolean; link?: string }
export type Mark = keyof Marks;
export interface TextSpan extends Marks { start: number; end: number }
export interface TextModel { text: string; textSpans?: TextSpan[] }
export interface Style {
  strokeColor: string; backgroundColor: string; strokeWidth: number; strokeStyle: string;
  fillStyle: string; roughness: number; roundness: Roundness | null; opacity: number;
  fontSize: number; fontFamily: number;
  textAlign?: 'left' | 'center' | 'right';
}
export interface Element extends Box, Style, TextModel {
  created?: number | null;
  baseHeight?: number;
  baseFontSize?: number | null;
  textWidth?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  id: string; type: Tool | 'frame' | 'image'; seed: number; points: number[][]; angle: number;
  imageData?: string; fileId?: string; scale?: [number, number];
  status?: 'pending' | 'saved' | 'error';
  locked?: boolean; link?: string | null; frameId?: string | null; containerId?: string | null; name?: string;
  version: number; versionNonce: number; isDeleted: boolean; groupIds: string[];
  boundElements: unknown; updated: number;
  pressures?: number[]; simulatePressure?: boolean; startArrowhead?: string | null;
  endArrowhead?: string | null; elbowed?: boolean; strokeOptions?: unknown;
  startBinding?: EndpointBinding | null; endBinding?: EndpointBinding | null;
}
export interface ImportResult { elements: Element[]; skipped: number; appState: Record<string, unknown> }
export interface TextContext { font: string; textBaseline: CanvasTextBaseline; measureText(text: string): { width: number; actualBoundingBoxDescent: number } }
export interface RenderPath { d: string; fill?: string; stroke: string; strokeWidth: number; dash: number[]; fillRule: CanvasFillRule }
