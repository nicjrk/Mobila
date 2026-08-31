import { useCallback, useRef, useState } from "react";

type Updater<T> = T | ((current: T) => T);

/** Small immutable history stack for editor-style undo/redo. */
export function useHistoryState<T>(initial: T) {
  const [value, setValueState] = useState(initial);
  const valueRef = useRef(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const transaction = useRef<{ initial: T } | null>(null);
  const [, refresh] = useState(0);

  const setValue = useCallback((next: Updater<T>) => {
    const transactionActive = transaction.current !== null;
    setValueState((current) => {
      const resolved = typeof next === "function" ? (next as (v: T) => T)(current) : next;
      if (Object.is(resolved, current)) return current;
      valueRef.current = resolved;
      // A live drag is a single editor action. Its intermediate states are
      // intentionally not added to the undo stack until commitTransaction().
      if (transactionActive) return resolved;
      past.current = [...past.current.slice(-49), current];
      future.current = [];
      refresh((v) => v + 1);
      return resolved;
    });
  }, []);

  const beginTransaction = useCallback(() => {
    if (transaction.current) return;
    transaction.current = { initial: valueRef.current };
    refresh((v) => v + 1);
  }, []);

  const setTransient = useCallback((next: Updater<T>) => {
    setValueState((current) => {
      const resolved = typeof next === "function" ? (next as (v: T) => T)(current) : next;
      if (Object.is(resolved, current)) return current;
      valueRef.current = resolved;
      return resolved;
    });
  }, []);

  const commitTransaction = useCallback(() => {
    const currentTransaction = transaction.current;
    if (!currentTransaction) return;
    transaction.current = null;
    setValueState((current) => {
      valueRef.current = current;
      if (!Object.is(currentTransaction.initial, current)) {
        past.current = [...past.current.slice(-49), currentTransaction.initial];
        future.current = [];
      }
      refresh((v) => v + 1);
      return current;
    });
  }, []);

  const cancelTransaction = useCallback(() => {
    const currentTransaction = transaction.current;
    if (!currentTransaction) return;
    transaction.current = null;
    valueRef.current = currentTransaction.initial;
    setValueState(currentTransaction.initial);
    refresh((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous === undefined) return;
    setValueState((current) => {
      future.current = [current, ...future.current].slice(0, 50);
      valueRef.current = previous;
      refresh((v) => v + 1);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    const next = future.current.shift();
    if (next === undefined) return;
    setValueState((current) => {
      past.current = [...past.current.slice(-49), current];
      valueRef.current = next;
      refresh((v) => v + 1);
      return next;
    });
  }, []);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    transaction.current = null;
    valueRef.current = next;
    setValueState(next);
    refresh((v) => v + 1);
  }, []);

  return {
    value,
    setValue,
    setTransient,
    beginTransaction,
    commitTransaction,
    cancelTransaction,
    isTransaction: transaction.current !== null,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
