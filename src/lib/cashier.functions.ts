import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cashierQuote } from "./trading-rules";

/** Start an M-Pesa STK push deposit through PalPluss. Credit happens only after verified webhook/poll. */
export const startDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ amount: z.number().int().min(10).max(150000), phone: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const pal = await import("./palpluss.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = pal.toMsisdn(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number");
    const { data: prof } = await supabaseAdmin.from("profiles").select("frozen").eq("id", context.userId).single();
    if (prof?.frozen) throw new Error("Account is frozen");
    const q = cashierQuote(data.amount, true);
    const reference = "PK" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("cashier_transactions")
      .insert({ user_id: context.userId, type: "deposit", amount: data.amount, fee: q.fee, net: data.amount, phone, status: "pending", reference })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not start deposit");
    try {
      const tx = await pal.stkPush({ amount: q.total, phone, reference });
      await supabaseAdmin.from("cashier_transactions").update({ palpluss_id: tx.transactionId, updated_at: new Date().toISOString() }).eq("id", row.id);
    } catch (e) {
      await supabaseAdmin.rpc("finalize_cashier", { p_id: row.id, p_status: "FAILED", p_receipt: null as unknown as string, p_payload: { error: String(e) } });
      throw e instanceof Error ? e : new Error("M-Pesa request failed");
    }
    return { id: row.id, reference };
  });

/** Poll fallback: re-verify a pending transaction directly with PalPluss. */
export const checkCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("cashier_transactions").select("*").eq("id", data.id).single();
    if (!t || t.user_id !== context.userId) throw new Error("Not found");
    if (t.palpluss_id && ["pending", "processing"].includes(t.status ?? "")) {
      const pal = await import("./palpluss.server");
      const tx = await pal.getTransaction(t.palpluss_id).catch(() => null);
      if (tx && ["SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"].includes(tx.status)) {
        await supabaseAdmin.rpc("finalize_cashier", { p_id: t.id, p_status: tx.status, p_receipt: (tx.mpesaReceipt ?? tx.mpesa_receipt ?? null) as string, p_payload: tx as never });
      }
    }
    const { data: fresh } = await supabaseAdmin.from("cashier_transactions").select("status, mpesa_receipt").eq("id", data.id).single();
    return { status: fresh?.status ?? "pending", receipt: fresh?.mpesa_receipt ?? null };
  });

/** Finance staff: release a pending withdrawal through PalPluss B2C. */
export const releaseWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: fin }, { data: sa }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "finance" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
    ]);
    if (!fin && !sa) throw new Error("Finance staff only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Claim atomically so a double click cannot pay twice.
    const { data: t } = await supabaseAdmin
      .from("cashier_transactions")
      .update({ status: "processing", reviewed_by: context.userId, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("type", "withdrawal").eq("status", "pending")
      .select("*").single();
    if (!t) throw new Error("Withdrawal is not pending");
    const pal = await import("./palpluss.server");
    try {
      const tx = await pal.b2cPayout({ amount: Number(t.net ?? t.amount), phone: t.phone, reference: t.reference ?? t.id });
      await supabaseAdmin.from("cashier_transactions").update({ palpluss_id: tx.transactionId }).eq("id", t.id);
    } catch (e) {
      await supabaseAdmin.rpc("finalize_cashier", { p_id: t.id, p_status: "FAILED", p_receipt: null as unknown as string, p_payload: { error: String(e) } });
      throw e instanceof Error ? e : new Error("Payout failed");
    }
    return { ok: true };
  });
