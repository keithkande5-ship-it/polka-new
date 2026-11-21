import { useSyncExternalStore } from "react";
import type { News } from "./markets";
import { supabase } from "@/integrations/supabase/client";
/** Preview-only admin state. Lives in memory for this session; no server enforces roles. */
export type AdminRole = "operator" | "finance" | "super_admin";
export type SiteLinks = { whatsapp: string; channel: string; telegram: string; x: string; support: string };
const LINKS_KEY = "polka-site-links";
export const DEFAULT_WA_COMMUNITY = "https://chat.whatsapp.com/";
export const DEFAULT_WA_CHANNEL = "https://whatsapp.com/channel/";
export type Resolution = {
  marketId: string;
  outcome: string;
  markedAt: number;
  challenges: { id: string; user: string; claim: string; at: number }[];
  final: boolean;
};
export type RiskFlag = {
  id: string;
  user: string;
  kind: "velocity" | "collusion" | "multi-account";
  detail: string;
  frozen: boolean;
};

type State = {
  role: AdminRole | null;
  links: SiteLinks;
  notice: string;
  news: (News & { marketId: string })[];
  resolutions: Record<string, Resolution>;
  flags: RiskFlag[];
  alert: { text: string; tone: "amber" | "red" } | null;
  triggers: { won: boolean; voided: boolean; withdrawal: boolean; account: boolean };
};

let state: State = {
  role: null,
  links: { whatsapp: "", channel: "", telegram: "", x: "", support: "" },
  notice: "",
  news: [],
  resolutions: {},
  flags: [],
  alert: null,
  triggers: { won: true, voided: true, withdrawal: true, account: true },
};
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
export function setAdmin(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  if (p.links && typeof window !== "undefined") {
    try { localStorage.setItem(LINKS_KEY, JSON.stringify(state.links)); } catch { /* ignore */ }
  }
  listeners.forEach((l) => l());
}
export function useAdmin() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
export function getAdminState() {
  return state;
}
export function useMarketNews(marketId: string) {
  const s = useAdmin();
  return s.news.filter((n) => n.marketId === marketId);
}

/** Load CMS-edited community links and broadcast alert from database across all devices. */
export function hydrateLinks() {
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    if (raw) setAdmin((s) => ({ links: { ...s.links, ...(JSON.parse(raw) as Partial<SiteLinks>) } }));
  } catch { /* ignore */ }
  if (typeof window !== "undefined") {
    void supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["site_links", "site_alert"])
      .then(({ data }) => {
        if (!data) return;
        const linksRow = data.find((r) => r.key === "site_links");
        const alertRow = data.find((r) => r.key === "site_alert");
        setAdmin((s) => ({
          links: linksRow ? { ...s.links, ...(linksRow.value as Partial<SiteLinks>) } : s.links,
          alert: alertRow ? (alertRow.value as State["alert"]) : s.alert,
        }));
      });
  }
}
