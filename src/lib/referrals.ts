import { useSyncExternalStore } from "react";
import { referralLedgerKey } from "./trading-rules";

/** One commission payment earned from a referred friend's trading fee (preview, browser-only). */
export type Commission = {
  id: string;
  at: number;
  friend: string;
  market: string;
  stake: number;
  fee: number;
  amount: number;
};

const listeners = new Set<() => void>();
const cache = new Map<string, Commission[]>();
const EMPTY: Commission[] = [];

function read(key: string): Commission[] {
  const hit = cache.get(key);
  if (hit) return hit;
  let list: Commission[] = [];
  try {
    list = JSON.parse(localStorage.getItem(key) ?? "[]") as Commission[];
  } catch {
    list = [];
  }
  cache.set(key, list);
  return list;
}

export function recordCommission(referrerHandle: string, c: Omit<Commission, "id" | "at">) {
  if (c.amount <= 0) return;
  const key = referralLedgerKey(referrerHandle);
  const next = [{ ...c, id: crypto.randomUUID(), at: Date.now() }, ...read(key)];
  cache.set(key, next);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useCommissions(handle?: string | null): Commission[] {
  const key = handle ? referralLedgerKey(handle) : null;
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (key ? read(key) : EMPTY),
    () => EMPTY,
  );
}

/** Masks a handle for privacy: @kibet_22 -> @kib***. */
export function maskHandle(h: string) {
  const clean = h.replace(/^@/, "");
  return `@${clean.slice(0, 3)}***`;
}
