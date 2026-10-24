import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** Per-account, per-unit and per-tab drafts survive reloads without mixing units. */
export function useSessionDraft<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const read = (): T => {
    try { const saved = sessionStorage.getItem(key); return saved ? JSON.parse(saved) : initial; }
    catch { return initial; }
  };
  const [state, setState] = useState(() => ({ key, value: read() }));
  const value = state.key === key ? state.value : read();
  useEffect(() => {
    if (state.key !== key) return;
    try { sessionStorage.setItem(key, JSON.stringify(state.value)); } catch { /* Storage unavailable. */ }
  }, [key, state]);
  const update: Dispatch<SetStateAction<T>> = next => {
    setState(previous => {
      const current = previous.key === key ? previous.value : read();
      const updated = typeof next === 'function' ? (next as (v: T) => T)(current) : next;
      // Persist synchronously: a reload must not race the next React effect.
      try { sessionStorage.setItem(key, JSON.stringify(updated)); } catch { /* Keep the in-memory draft. */ }
      return { key, value: updated };
    });
  };
  return [value, update];
}