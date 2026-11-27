import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fmtAxisKES, niceDomain, fmtKES, fmtDateTime, fmtResolveEta, positionResolveAt, useNowTick } from "@/lib/markets";
import { useStore } from "@/lib/store";
import { StepChart } from "@/components/polka/StepChart";
import { Btn3D } from "@/components/polka/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Your positions and P&L | Polka" },
      { name: "description", content: "Track your open positions, returns and profit on Polka." },
      { property: "og:title", content: "Portfolio | Polka" },
      { property: "og:description", content: "Your positions and P&L on Polka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portfolio,
});

function Portfolio() {
  const { positions, balance, user, openAuth } = useStore();
  const now = useNowTick(30_000);

  const open = positions.filter((p) => p.status === "open");
  const settled = positions.filter((p) => p.status === "won" || p.status === "lost");
  const pnl = settled.reduce(
    (s, p) => s + (p.status === "won" ? p.stake * p.mult - p.stake : -p.stake),
    0,
  );
  const pnlData = useMemo(() => {
    let total = 0;
    return [
      { t: 0, p: 0 },
      { t: 1, p: 0 },
      ...positions
        .filter((p) => p.status !== "open")
        .slice()
        .reverse()
        .map((p, i) => {
          total += p.status === "won" ? p.stake * p.mult - p.stake : -p.stake;
          return { t: i + 2, p: total };
        }),
    ];
  }, [positions]);
  if (!user)
    return (
      <div className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="my-4 text-muted-foreground">Log in to view your open positions.</p>
        <Btn3D variant="primary" className="h-11 px-5" onClick={() => openAuth()}>
          Log in
        </Btn3D>
      </div>
    );
  const stats = [
    ["Cash balance", fmtKES(balance, 2), ""],
    ["In open positions", fmtKES(open.reduce((s, p) => s + p.stake, 0)), ""],
    ["Projected payout", fmtKES(open.reduce((s, p) => s + p.stake * p.mult, 0)), "text-up"],
    ["Realised P&L", `${pnl >= 0 ? "+" : "−"}${fmtKES(Math.abs(pnl))}`, pnl >= 0 ? "text-up" : "text-down"],
    ["Win rate", settled.length ? `${Math.round((settled.filter((p) => p.status === "won").length / settled.length) * 100)}%` : "—", ""],
  ];
  const Table = ({ rows }: { rows: typeof positions }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-2 font-medium">Market</th>
            <th className="px-2 py-2 font-medium">Pick</th>
            <th className="px-2 py-2 text-right font-medium">Amount</th>
            <th className="px-2 py-2 text-right font-medium">Mult</th>
            <th className="px-2 py-2 text-right font-medium">Payout</th>
            <th className="px-2 py-2 text-right font-medium">Profit</th>
            <th className="px-4 py-2 text-right font-medium">Resolves / Settled</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="max-w-64 truncate px-4 py-3">{p.title}</td>
              <td className="px-2 py-3 font-medium">{p.outcome}</td>
              <td className="num px-2 py-3 text-right">{fmtKES(p.stake)}</td>
              <td className="num px-2 py-3 text-right">{p.mult.toFixed(2)}x</td>
              <td
                className={cn(
                  "num px-2 py-3 text-right font-bold",
                  p.status === "lost" ? "text-down" : "text-up",
                )}
              >
                {p.status === "lost"
                  ? `Loss -${fmtKES(p.stake)}`
                  : p.status === "won"
                    ? `Profit +${fmtKES(p.stake * p.mult - p.stake)}`
                    : "—"}
              </td>
              <td className="num px-2 py-3 text-right">
                {(() => {
                  const won = p.status === "won";
                  const lost = p.status === "lost";
                  const profit = lost ? -p.stake : p.stake * p.mult - p.stake;
                  if (p.status === "voided") return <span className="text-muted-foreground">KES 0</span>;
                  const roi = Math.round((profit / Math.max(1, p.stake)) * 100);
                  return (
                    <span className={cn("font-bold", lost ? "text-down" : won ? "text-up" : "text-muted-foreground")}>
                      {profit >= 0 ? "+" : "−"}{fmtKES(Math.abs(profit))}
                      <span className="ml-1 text-[10px] font-semibold opacity-80">{roi >= 0 ? "+" : ""}{roi}%{p.status === "open" ? " potential" : ""}</span>
                    </span>
                  );
                })()}
              </td>              <td className="px-4 py-3 text-right text-xs">
                {p.status === "open" ? (
                  <span className="num text-muted-foreground">
                    in {fmtResolveEta(positionResolveAt(p) - now)}
                  </span>
                ) : p.status === "won" ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                    Won
                  </span>
                ) : p.status === "lost" ? (
                  <span className="inline-flex items-center rounded-md bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[11px] font-bold text-orange-400">
                    Lost
                  </span>
                ) : p.status === "voided" ? (
                  <span className="inline-flex items-center rounded-md bg-secondary border border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    Voided
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-destructive font-medium">
                    <span>Error</span>
                    <span>·</span>
                    <a
                      href={`mailto:support@polka.co.ke?subject=Position%20Report%20${p.id}`}
                      className="text-primary underline hover:opacity-80"
                    >
                      Report
                    </a>
                  </span>
                )}
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 pt-4 md:px-6 md:pt-6">
      <h1 className="text-2xl font-bold">Portfolio</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([l, v, c]) => (
          <div key={l} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className={cn("num mt-1 break-words text-base font-bold", c)}>{v}</p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">P&amp;L performance</p>
        <StepChart
          data={pnlData}
          domain={niceDomain(pnlData.map((p) => p.p))}
          valueFormat={fmtAxisKES}
          color={pnl >= 0 ? "var(--up)" : "var(--down)"}
        />
      </section>
      <section className="rounded-xl border bg-card">
        <p className="border-b px-4 py-3 text-sm font-semibold">Active positions</p>
        {open.length ? (
          <Table rows={open} />
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No open positions.</p>
        )}
      </section>
      <section className="rounded-xl border bg-card">
        <p className="border-b px-4 py-3 text-sm font-semibold">Settled</p>
        <Table rows={settled} />
      </section>
    </div>
  );
}
