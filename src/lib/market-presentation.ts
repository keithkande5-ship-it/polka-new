import type { Market } from "./markets";

export const FLASH_RESULT_DISPLAY_MS = 8_000;

export function outcomeTone(market: Market, index: number, winner = false) {
  if (market.outcomes.length === 2) {
    const label = market.outcomes[index]?.label.toLowerCase();
    return winner && label === "yes" ? "winner-yes" : index === 1 ? "down" : "up";
  }
  return ["chart-1", "chart-2", "chart-3", "chart-4"][index % 4] ?? "chart-1";
}

export function closedMarketLabel(market: Market) {
  return market.state === "settled"
    ? "Market Closed · Payouts Sent"
    : "Market Closed · Payouts Pending";
}
export type MarketBadge = { label: string; tone: "new" | "closing" | "vol" | "live" | "tossup" | "resolving" };

/** Logic pill shown on market cards. Reads existing lifecycle data only. */
export function marketBadge(m: Market, volRank: number, now: number): MarketBadge | null {
  const state = m.state ?? "open";
  if (state === "proposed" || state === "closed") return { label: "Resolving", tone: "resolving" };
  if (state !== "open") return null;
  if (m.sport?.liveMin !== undefined) return { label: "Live", tone: "live" };
  const left = m.closesAt ? m.closesAt - now : Infinity;
  if (left > 0 && left < 86_400_000) return { label: "Closing soon", tone: "closing" };
  if (m.flat) return { label: "New", tone: "new" };
  if (volRank >= 0 && volRank < 3) return { label: `#${volRank + 1} Vol`, tone: "vol" };
  const top = Math.max(...m.outcomes.map((o) => o.prob));
  if (m.outcomes.length === 2 && top <= 0.6) return { label: "50/50", tone: "tossup" };
  return null;
}

/** Feed ranking: volume weight × urgency × toss-up tension × freshness. */
export function rankScore(m: Market, now: number): number {
  const state = m.state ?? "open";
  if (state !== "open") return Math.pow(m.volume + 1, 0.55) * 0.2;
  const left = m.closesAt ? m.closesAt - now : Infinity;
  const urgency = left > 0 && left < 86_400_000 ? 1.8 : 1;
  const top = Math.max(...m.outcomes.map((o) => o.prob));
  const tension = top >= 0.4 && top <= 0.6 ? 1.5 : 1;
  const fresh = m.flat ? 2.2 : 1;
  return Math.pow(m.volume + 1, 0.55) * urgency * tension * fresh;
}
