export const avatarPresets = [
  "Sunset",
  "Emerald / Cyan",
  "Indigo / Violet",
  "Rose / Crimson",
  "Slate",
  "Gold / Teal",
] as const;
export type TraderProfile = {
  id: string;
  displayName: string;
  handle: string;
  avatar: number;
  bio: string;
  joined: string;
  phone: string;
  oneClick: boolean;
  quickAmounts: number[];
  stkAlerts: boolean;
  resolutionAlerts: boolean;
  replyAlerts: boolean;
  /** Handle of the inviter when the account signed up via /r/:handle. */
  referredBy?: string;
  /** Epoch ms of signup; anchors the 24h zero-fee window. */
  joinedAt?: number;
};
export function avatarIndex(handle: string) {
  return [...handle].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
}
export function newProfile(displayName: string): TraderProfile {
  const handle = `trader_${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    id: crypto.randomUUID(),
    displayName: displayName || "New trader",
    handle,
    avatar: avatarIndex(handle),
    bio: "",
    joined: new Date().toISOString(),
    phone: "",
    oneClick: false,
    quickAmounts: [50, 100, 500, 1000],
    stkAlerts: true,
    resolutionAlerts: true,
    replyAlerts: true,
  };
}
