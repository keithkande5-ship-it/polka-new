import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAIRS: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", BNB: "BNBUSDT", XRP: "XRPUSDT" };

async function minuteCandle(sym: string, startMs: number): Promise<{ open: number; close: number } | null> {
  const pair = PAIRS[sym];
  if (!pair) return null;
  for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
    try {
      const r = await fetch(`${host}/api/v3/klines?symbol=${pair}&interval=1m&startTime=${startMs}&limit=1`);
      if (!r.ok) continue;
      const rows = (await r.json()) as [number, string, string, string, string][];
      const k = rows[0];
      if (!k || k[0] !== startMs) return null;
      return { open: Number(k[1]), close: Number(k[4]) };
    } catch {
      /* try next host */
    }
  }
  return null;
}

/** Server oracle: settle the caller's due Flash / daily crypto positions from Binance candles. */
export const settleDueCrypto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: due } = await supabaseAdmin
      .from("positions").select("*")
      .eq("user_id", context.userId).eq("status", "open")
      .lt("resolves_at", new Date(Date.now() - 5_000).toISOString())
      .limit(50);
    let settled = 0;
    for (const p of due ?? []) {
      if (!p.asset || !p.resolves_at) continue;
      const end = Date.parse(p.resolves_at);
      let result: "won" | "lost" | "void" | null = null;
      if (p.market_id === "flash" && p.round != null) {
        const c = await minuteCandle(p.asset, Number(p.round) * 60_000);
        if (c) result = (c.close >= c.open ? "UP" : "DOWN") === p.outcome ? "won" : "lost";
      } else if (p.market_id.startsWith("eat-") && p.lock_price != null) {
        const c = await minuteCandle(p.asset, end - 60_000);
        if (c) result = ((c.close > Number(p.lock_price)) ? "Yes" : "No") === p.outcome ? "won" : "lost";
      } else continue;
      // Feed unavailable for >10 min after close: void and refund.
      if (!result && Date.now() - end > 600_000) result = "void";
      if (!result) continue;
      await supabaseAdmin.rpc("settle_crypto_position", { p_id: p.id, p_result: result });
      settled++;
    }
    return { settled };
  });
