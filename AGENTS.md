<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Imported Polka application

- Keep Polka's account, balance, cashier, market-feed, and operator flows explicitly browser-only previews; the source has no production service or server-side authorization.
- Keep fee schedules and trade eligibility centralized in `src/lib/trading-rules.ts`, because all simulated order paths must share the same tested rules.
- Keep global order entry available at every viewport so users can place a preview order without getting stranded on search or intermediate screens.
- Treat fallback market data as synthetic and pause Flash execution when a live feed is unavailable; this app does not include a production settlement oracle.
- Derive binary-market No chart history from the Yes series with `mirrorHistory` to keep both curves mathematically aligned.
- Scope browser-persisted user state by profile helpers in `src/lib/trading-rules.ts` so simulated users do not share timers.
- Centralize share and referral URLs in `src/lib/site.ts` so a later domain cutover has one source of truth.
- Keep market presentation tied to market lifecycle and settlement data; display helpers must not settle markets.
- Read and write market discussions through validated browser-only helpers after hydration and explicit user actions to preserve saved comments.
- Keep operator workspaces on the shared React preview session and store actions; PINs and gestures are concealment, not authorization.
- Store market close times and spotlight choices on the market model and update them through `editMarket` so operator edits reach public views.
- Keep the imported TanStack file routes and root-level `StoreProvider` shell together; this preserves the existing app-wide preview state and navigation behavior.
