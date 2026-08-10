import { useCallback, useRef, useState } from "react";

type Updater<T> = T | ((current: T) => T);

/** Small immutable history stack for editor-style undo/redo. */
export function useHistoryState<T>(initial: T) {
  const [value, setValueState] = useState(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, refresh] = useState(0);

  const setValue = useCallback((next: Updater<T>) => {
    setValueState((current) => {
      const resolved = typeof next === "function" ? (next as (v: T) => T)(current) : next;
      if (Object.is(resolved, current)) return current;
      past.current = [...past.current.slice(-49), current];
      future.current = [];
      refresh((v) => v + 1);
      return resolved;
    });
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous === undefined) return;
    setValueState((current) => {
      future.current = [current, ...future.current].slice(0, 50);
      refresh((v) => v + 1);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    const next = future.current.shift();
    if (next === undefined) return;
    setValueState((current) => {
      past.current = [...past.current.slice(-49), current];
      refresh((v) => v + 1);
      return next;
    });
  }, []);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    setValueState(next);
    refresh((v) => v + 1);
  }, []);

  return {
    value,
    setValue,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
