// Server-only PalPluss helpers. Import only from server function handlers / server routes.
const BASE = "https://api.palpluss.com/v1";

function authHeader() {
  const key = process.env["PALPLUSS_API_KEY"];
  if (key) return "Basic " + btoa(`${key}:`);
  const token = process.env["PALPLUSS_BASIC_AUTH_TOKEN"] ?? process.env["PLAPLUSS_BASIC_AUTH_TOKEN"];
  if (token) return token.startsWith("Basic ") ? token : `Basic ${token}`;
  throw new Error("PalPluss API key is not configured");
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null;
  if (!res.ok || !body?.success || !body.data) {
    throw new Error(body?.error?.message ?? `PalPluss request failed (${res.status})`);
  }
  return body.data;
}

export function siteUrl() {
  return (process.env["APP_URL"] ?? "https://polka.co.ke").replace(/\/$/, "");
}

export function stkPush(input: { amount: number; phone: string; reference: string }) {
  return call<{ transactionId: string; status: string }>("/payments/stk", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amount,
      phone: input.phone,
      accountReference: input.reference.slice(0, 12),
      transactionDesc: "Polka deposit".slice(0, 13),
      ...(process.env["PALPLUSS_CHANNEL_ID"] ? { channelId: process.env["PALPLUSS_CHANNEL_ID"] } : {}),
      callbackUrl: `${siteUrl()}/api/public/palpluss-webhook`,
    }),
  });
}

export function b2cPayout(input: { amount: number; phone: string; reference: string }) {
  return call<{ transactionId: string; status: string }>("/b2c/payouts", {
    method: "POST",
    headers: { "Idempotency-Key": input.reference },
    body: JSON.stringify({
      amount: input.amount,
      phone: input.phone,
      reference: input.reference,
      description: "Polka withdrawal",
      callbackUrl: `${siteUrl()}/api/public/palpluss-webhook`,
    }),
  });
}

export type PalTx = { transactionId?: string; status: string; amount: number; accountReference?: string; reference?: string; mpesaReceipt?: string | null; mpesa_receipt?: string | null };
export async function getTransaction(id: string): Promise<PalTx> {
  const r = await call<Record<string, unknown>>(`/transactions/${encodeURIComponent(id)}`);
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : undefined);
  const desc = s("result_desc") ?? s("resultDescription") ?? "";
  const receipt = desc.match(/receipt:?\s*([A-Z0-9]{8,12})/i)?.[1] ?? null;
  return {
    transactionId: s("transaction_id") ?? s("transactionId"),
    status: String(r["status"] ?? "PENDING").toUpperCase(),
    amount: Number(r["amount"] ?? 0),
    accountReference: s("external_reference") ?? s("accountReference"),
    mpesaReceipt: s("mpesaReceipt") ?? receipt ?? (String(r["status"]).toUpperCase() === "SUCCESS" ? s("provider_checkout_id") ?? null : null),
  };
}

/** Phone in 2547XXXXXXXX form. */
export function toMsisdn(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^254/, "").replace(/^0/, "");
  return /^[17]\d{8}$/.test(d) ? `254${d}` : null;
}
