import { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import React, { act } from 'react';
import Whiteboard from '../../src/whiteboard/Whiteboard.tsx';
import { renderToString } from 'react-dom/server';
import { appearanceBootstrap } from '../../src/appearance.ts';
// React detects input-event support when ReactDOM is first imported.
const bootstrap = new JSDOM('<!doctype html><html><body></body></html>');
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
Object.defineProperty(globalThis, 'document', { value: bootstrap.window.document, configurable: true });
Object.defineProperty(globalThis, 'window', { value: bootstrap.window, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: bootstrap.window.navigator, configurable: true });
const { createRoot, hydrateRoot } = await import('react-dom/client');
if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document;
if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
bootstrap.window.close();
const mounted = [];
const original = new Map();
function globals(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!original.has(key)) original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
}
afterEach(() => {
  const errors = [];
  for (const app of mounted.splice(0)) { app.activate(); act(() => app.root.unmount()); app.dom.window.close(); errors.push(...app.errors); }
  for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  original.clear();
  assert.deepEqual(errors, [], 'browser event handlers must not throw');
});
export function createApp({ savedElements = [], zoom = 1, pan = { x: 0, y: 0 }, theme = 'light', width = 1440, height = 900, storageEntries = {}, savedLocal = {}, storageError = false, readError = false, strict = false, fonts, hydrate = false, beforeHydrate } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/', runScripts: hydrate ? 'outside-only' : undefined });
  const { window } = dom, { document } = window;
  if (fonts) Object.defineProperty(document, 'fonts', { value: fonts });
  const errors = []; window.addEventListener('error', event => errors.push(event.error));
  const timers = new Map(), frames = new Map(), opened = [], downloads = [], filenames = [], captures = new Set(); let timerId = 0;
  window.structuredClone = structuredClone; window.Path2D = Path2D; window.Blob = globalThis.Blob;
  window.innerWidth = width; window.innerHeight = height;
  window.requestAnimationFrame = fn => { const id = ++timerId; frames.set(id, fn); return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.setTimeout = (fn, ms) => { const id = ++timerId; if (ms === 300) timers.set(id, fn); return id; };
  window.clearTimeout = id => timers.delete(id);
  window.open = (...args) => opened.push(args);
  window.URL.createObjectURL = blob => { downloads.push(blob); return `blob:test-${downloads.length}`; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button,input')?.focus(); };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.HTMLAnchorElement.prototype.click = function () { if (this.download) filenames.push(this.download); };
  const canvases = new WeakMap();
  window.HTMLCanvasElement.prototype.getContext = function () {
    if (!canvases.has(this)) canvases.set(this, createCanvas(this.width, this.height));
    return canvases.get(this).getContext('2d');
  };
  for (const key of ['width', 'height']) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLCanvasElement.prototype, key);
    Object.defineProperty(window.HTMLCanvasElement.prototype, key, { ...descriptor, set(value) { descriptor.set.call(this, value); if (canvases.has(this)) canvases.get(this)[key] = value; } });
  }
  Object.defineProperties(window.HTMLCanvasElement.prototype, { clientWidth: { get: () => width }, clientHeight: { get: () => height } });
  window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  window.HTMLCanvasElement.prototype.setPointerCapture = id => captures.add(id);
  window.HTMLCanvasElement.prototype.toBlob = function (callback) { callback(new Blob([canvases.get(this).toBuffer('image/png')], { type: 'image/png' })); };
  window.localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: savedElements, local: { zoom, pan, theme, ...savedLocal } }));
  for (const [key, value] of Object.entries(storageEntries)) window.localStorage.setItem(key, value);
  if (storageError) window.Storage.prototype.setItem = () => { throw new Error('Storage full'); };
  if (readError) window.Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
  function activate() {
    globals({ window, document, navigator: window.navigator, HTMLElement: window.HTMLElement, Node: window.Node, Event: window.Event,
      AbortController: window.AbortController, localStorage: window.localStorage, Path2D, URL: window.URL,
      innerWidth: width, innerHeight: height, devicePixelRatio: 1, requestAnimationFrame: window.requestAnimationFrame,
      cancelAnimationFrame: window.cancelAnimationFrame, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
      IS_REACT_ACT_ENVIRONMENT: true });
  }
  let frameTime = 0;
  function flushFrames(elapsed = 16) {
    frameTime += elapsed;
    act(() => { for (const [id, fn] of [...frames]) if (frames.delete(id)) fn(frameTime); });
  }
  activate();
  const container = document.getElementById('mount');
  const content = React.createElement(strict ? React.StrictMode : React.Fragment, null, React.createElement(Whiteboard));
  let root;
  if (hydrate) {
    container.innerHTML = renderToString(content);
    window.eval(appearanceBootstrap);
    beforeHydrate?.(window);
    act(() => { root = hydrateRoot(container, content, { onRecoverableError: error => errors.push(error) }); });
  } else {
    root = createRoot(container);
    act(() => root.render(content));
  }
  mounted.push({ activate, root, dom, errors });
  flushFrames();
  const get = id => document.getElementById(id), canvas = get('canvas'), editor = get('text-editor');
  function dispatch(target, type, input = {}) {
    activate(); const Event = type === 'keydown' || type === 'keyup' ? window.KeyboardEvent : type.startsWith('pointer') || type === 'click' || type === 'dblclick' ? window.MouseEvent : type === 'input' || type === 'beforeinput' ? window.InputEvent : window.Event;
    const event = new Event(type, { bubbles: true, cancelable: true, ...input });
    for (const [key, value] of Object.entries(input)) if (!(key in event)) Object.defineProperty(event, key, { value });
    act(() => target.dispatchEvent(event)); flushFrames(); return event;
  }
  function click(target, input = {}) {
    const down = dispatch(target, 'pointerdown', input); if (!down.defaultPrevented) act(() => target.focus());
    dispatch(target, 'pointerup', input); dispatch(target, 'click', input); captures.clear();
  }
  function select(start, end = start) {
    activate(); const walker = document.createTreeWalker(editor, 4), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const locate = offset => { for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length; } return [editor, 0]; };
    const range = document.createRange(); range.setStart(...locate(start)); range.setEnd(...locate(end));
    const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range); dispatch(document, 'selectionchange');
  }
  function scene() { activate(); act(() => { for (const [id, fn] of timers) { timers.delete(id); fn(); } }); flushFrames(); return JSON.parse(window.localStorage.getItem('sketchify.scene.v1')).elements; }
  return { get, canvas, editor, document, window, activate, dispatch, click, select, scene, captures, opened, downloads, filenames, pendingSaves: () => timers.size,
    advanceFrame(elapsed) { activate(); flushFrames(elapsed); },
    tool: name => click(document.querySelector(`[data-tool="${name}"]`)),
    input(value) { activate(); editor.textContent = value; select(value.length); dispatch(editor, 'input'); },
    type: value => dispatch(editor, 'beforeinput', { inputType: 'insertText', data: value }),
    key(key, options = {}) { activate(); return dispatch(document.activeElement, 'keydown', { key, ...options }); },
    property: (name, value) => document.querySelector(`[data-prop="${name}"][data-value="${value}"]`),
  };
}
