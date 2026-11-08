import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Payload = z.object({
  event: z.string().optional(),
  transaction: z.object({
    id: z.string().min(1).max(100),
    external_reference: z.string().max(100).nullable().optional(),
  }).passthrough(),
});

// PalPluss callbacks are unsigned, so we never trust the body: we look up our own
// pending row and re-fetch the transaction from PalPluss with our private key.
export const Route = createFileRoute("/api/public/palpluss-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("bad request", { status: 400 });
        const { id } = parsed.data.transaction;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const pal = await import("@/lib/palpluss.server");
        const { data: row } = await supabaseAdmin
          .from("cashier_transactions").select("id, amount, net, type, status, reference")
          .eq("palpluss_id", id).maybeSingle();
        if (!row) return new Response("ok");
        const tx = await pal.getTransaction(id).catch(() => null);
        if (!tx) return new Response("verify failed", { status: 502 });
        const ref = tx.accountReference ?? tx.reference;
        if (ref && row.reference && ref.slice(0, 12) !== row.reference.slice(0, 12)) return new Response("ok");
        if (!["SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"].includes(tx.status)) return new Response("ok");
        await supabaseAdmin.rpc("finalize_cashier", {
          p_id: row.id,
          p_status: tx.status,
          p_receipt: (tx.mpesaReceipt ?? tx.mpesa_receipt ?? null) as string,
          p_payload: tx as never,
        });
        return new Response("ok");
      },
    },
  },
});
