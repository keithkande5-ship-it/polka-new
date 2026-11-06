import { useSyncExternalStore } from "react";

/** Preview-only, browser-local telemetry for the operator console. No data leaves the device. */
export type TrackEvent = { id: string; at: number; kind: "view" | "click"; name: string; path: string };

const KEY = "polka-analytics";
const MAX = 500;
const listeners = new Set<() => void>();
let cache: TrackEvent[] | null = null;
const EMPTY: TrackEvent[] = [];

function read(): TrackEvent[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as TrackEvent[];
  } catch {
    cache = [];
  }
  return cache;
}

export function track(kind: TrackEvent["kind"], name: string) {
  if (typeof window === "undefined") return;
  const ev: TrackEvent = {
    id: Math.random().toString(36).slice(2),
    at: Date.now(),
    kind,
    name,
    path: window.location.pathname,
  };
  cache = [ev, ...read()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function clearAnalytics() {
  cache = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useAnalytics(): TrackEvent[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
}

/** Counts events by name, highest first. */
export function rank(events: TrackEvent[], kind: TrackEvent["kind"]) {
  const m = new Map<string, number>();
  for (const e of events) if (e.kind === kind) m.set(e.name, (m.get(e.name) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
