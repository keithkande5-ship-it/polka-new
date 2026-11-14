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
/** Referral bonus claim submitted by a user for admin approval. */
export type ReferralBonusClaim = {
  id: string;
  userId: string;
  userHandle: string;
  friendsCount: number;
  submittedAt: number;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: number;
  reviewedBy?: string;
  credited?: boolean;
};

const BONUS_CLAIMS_KEY = "polka-referral-bonus-claims";
const claimListeners = new Set<() => void>();

export function getBonusClaims(): ReferralBonusClaim[] {
  try {
    return JSON.parse(localStorage.getItem(BONUS_CLAIMS_KEY) ?? "[]") as ReferralBonusClaim[];
  } catch {
    return [];
  }
}

export function useBonusClaims(): ReferralBonusClaim[] {
  return useSyncExternalStore(
    (cb) => {
      claimListeners.add(cb);
      return () => claimListeners.delete(cb);
    },
    getBonusClaims,
    () => [],
  );
}

export function getUserBonusClaim(userId?: string | null): ReferralBonusClaim | null {
  if (!userId) return null;
  const list = getBonusClaims();
  return list.find((c) => c.userId === userId) ?? null;
}

export function submitBonusClaim(claim: { userId: string; userHandle: string; friendsCount: number }): boolean {
  if (claim.friendsCount < 5) return false;
  const list = getBonusClaims();
  const existing = list.find((c) => c.userId === claim.userId);
  if (existing && existing.status === "pending") return false;
  const updated: ReferralBonusClaim = {
    id: existing?.id ?? crypto.randomUUID(),
    userId: claim.userId,
    userHandle: claim.userHandle,
    friendsCount: claim.friendsCount,
    submittedAt: Date.now(),
    status: "pending",
    credited: false,
  };
  const next = [updated, ...list.filter((c) => c.userId !== claim.userId)];
  try {
    localStorage.setItem(BONUS_CLAIMS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  claimListeners.forEach((l) => l());
  return true;
}

export function reviewBonusClaim(claimId: string, status: "approved" | "rejected", adminName: string): boolean {
  const list = getBonusClaims();
  const target = list.find((c) => c.id === claimId);
  if (!target) return false;
  target.status = status;
  target.reviewedAt = Date.now();
  target.reviewedBy = adminName;
  try {
    localStorage.setItem(BONUS_CLAIMS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  claimListeners.forEach((l) => l());
  return true;
}

export function markClaimCredited(claimId: string): void {
  const list = getBonusClaims();
  const target = list.find((c) => c.id === claimId);
  if (!target) return;
  target.credited = true;
  try {
    localStorage.setItem(BONUS_CLAIMS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  claimListeners.forEach((l) => l());
}
