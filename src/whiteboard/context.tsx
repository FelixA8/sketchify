import { createContext, useCallback, useContext, useSyncExternalStore, type RefObject } from 'react';
import type { Store } from './store';
import type { Controller } from './controller';
export const BoardContext = createContext<{ store: Store; controller: RefObject<Controller | null> } | null>(null);
export function useBoard() {
  const context = useContext(BoardContext)!;
  const state = useSyncExternalStore(context.store.subscribe, context.store.getSnapshot, context.store.getSnapshot);
  const controller = context.controller;
  const run = useCallback((fn: (app: Controller) => void) => { const app = controller.current; if (app) app.run(() => fn(app)); }, [controller]);
  return { state, run };
}
