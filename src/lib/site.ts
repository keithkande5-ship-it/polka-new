/** Public brand domain. Used for share and referral links. */
export const SITE_DOMAIN = "polka.co.ke";
export const SITE_URL = `https://${SITE_DOMAIN}`;

/** Referral links always use the short /r/<handle> form on the brand domain. */
export function referralLink(handle?: string | null, path = "/") {
  if (handle) return `${SITE_URL}/r/${handle.replace(/^@/, "")}${path === "/" ? "" : `?to=${encodeURIComponent(path)}`}`;
  return `${SITE_URL}${path}`;
}
