"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-viewer conveniences (chosen role, cards vs table) kept in localStorage.
// Reads through useSyncExternalStore so the server render and first client render agree.

const EVENT = "aipbs:pref";
const subscribe = (cb: () => void) => {
  addEventListener("storage", cb);
  addEventListener(EVENT, cb);
  return () => { removeEventListener("storage", cb); removeEventListener(EVENT, cb); };
};
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const value = useSyncExternalStore(subscribe, () => (read(key) as T | null) ?? fallback, () => fallback);
  const set = useCallback((v: T) => {
    try { localStorage.setItem(key, v); } catch {}
    dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, set];
}

const noop = () => () => {};
/** False during the server render and hydration, true afterwards (for things that need `document`). */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
