import { vaultPost, useVault } from "@/lib/trading-rules";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Download, Gavel, Wallet, Radio, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { setAdmin, useAdmin } from "@/lib/admin";
import {
  editMarket,
  fmtDateTime,
  fmtKES,
  getMarket,
  markets,
  setMarketLifecycle,
  useMarketsVersion,
  useNowTick,
} from "@/lib/markets";
import {
  DEFAULT_EVENT_POT_RAKE_BPS,
  cashierQuote,
  expiryBucket,
  extendMarketClose,
  settlementGuard,
  settlementPreview,
  solvencyCoverage,
} from "@/lib/trading-rules";
import { Tutorial } from "./Tutorial";

export function exportLedger(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function Metric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="border-b border-border py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
export function Treasury() {
  const { balance, positions } = useStore();
  const ledger = useVault();
  const vault = ledger.balance;
  const [topup, setTopup] = useState(0);
  const open = positions.filter((p) => p.status === "open" && p.marketId !== "flash");
  const liability = [...new Set(open.map((p) => p.marketId))].reduce((sum, id) => {
    const ps = open.filter((p) => p.marketId === id);
    return (
      sum +
      Math.max(
        0,
        ...[...new Set(ps.map((p) => p.outcome))].map(
          (outcome) => settlementPreview(ps, outcome).payout,
        ),
      )
    );
  }, 0);
  const cover = solvencyCoverage(vault, balance, liability);
  const { settlements } = useCommandState();
  const realized = settlements.reduce((sum, s) => sum + s.rake, 0);
  const estimate = (open.reduce((sum, p) => sum + p.stake, 0) * DEFAULT_EVENT_POT_RAKE_BPS) / 10000;
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Wallet className="size-4 text-up" /> Central vault
      </div>
      <p className="text-xs text-muted-foreground">
        Market seeds draw from the vault; Flash house P&L and rake sweep back into it.
      </p>
      <div className="grid gap-x-6 sm:grid-cols-3">
        <Metric label="Central vault balance" value={fmtKES(vault)} />
        <Metric label="Total player wallet balances" value={fmtKES(balance)} />
        <Metric label="Active open liabilities · worst outcome" value={fmtKES(liability)} />
      </div>
      <label className="block max-w-xs text-xs text-muted-foreground">
        Top up vault (KES)
        <div className="flex gap-2">
          <Input
            aria-label="Vault top-up"
            type="number"
            min="0"
            value={topup}
            onChange={(e) => setTopup(Math.max(0, Number(e.target.value) || 0))}
          />
          <button
            type="button"
            className="rounded-md border px-3 font-semibold text-foreground"
            onClick={() => topup > 0 && (vaultPost("topup", topup, "Operator top-up"), setTopup(0))}
          >
            Add
          </button>
        </div>
      </label>
      <div className="max-h-56 overflow-auto border-y text-xs">
        {ledger.entries.length === 0 && <p className="py-3 text-muted-foreground">No vault movements yet.</p>}
        {ledger.entries.map((e) => (
          <div key={e.id} className="flex justify-between gap-3 border-b py-1.5 last:border-0">
            <span className="truncate">{e.note}</span>
            <span className={`num shrink-0 ${e.amount >= 0 ? "text-up" : "text-down"}`}>
              {e.amount >= 0 ? "+" : ""}{fmtKES(e.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-y py-5">
        <div className="flex flex-wrap justify-between gap-3">
          <span className={`font-semibold ${cover.covered ? "text-up" : "text-chart-4"}`}>
            {cover.covered ? "100%+ COVERED" : "LOW FLOAT ALERT"}
          </span>
          <span className="num">{cover.percent.toFixed(1)}%</span>
        </div>
        <progress
          aria-label="Solvency coverage"
          max="100"
          value={Math.min(100, cover.percent)}
          className="mt-4 h-2 w-full accent-up"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Required cover {fmtKES(cover.required)} · wallet balances + maximum open payouts
        </p>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Metric label="Realized rake · guarded settlements" value={fmtKES(realized, 2)} />
        <Metric label="Unrealized rake · 5% open-stake estimate" value={fmtKES(estimate, 2)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Event rake is retained from the losing pool; unrealized estimates are not collected revenue.
        Flash is excluded from this event desk.
      </p>
    </section>
  );
}

// React session state is shared by mounted command workspaces; no payment service or private data.
type SettlementRecord = { market: string; rake: number; payout: number };
type CommandState = { settlements: SettlementRecord[]; record: (r: SettlementRecord) => void };
const CommandContext = createContext<CommandState>({ settlements: [], record: () => {} });
export function CommandProvider({ children }: { children: ReactNode }) {
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  return (
    <CommandContext.Provider
      value={{ settlements, record: (r) => setSettlements((s) => [...s, r]) }}
    >
      {children}
    </CommandContext.Provider>
  );
}
function useCommandState() {
  return useContext(CommandContext);
}

export function MarketOperations() {
  useMarketsVersion();
  const now = useNowTick(1000);
  const { positions, user, settlePosition, voidPosition } = useStore();
  const { record } = useCommandState();
  const [filter, setFilter] = useState("expired");
  const [mid, setMid] = useState(markets[0]?.id ?? "");
  const [guard, setGuard] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [verified, setVerified] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const m = getMarket(mid);
  const ledger = positions.filter((p) => p.marketId === mid && p.status === "open");
  const preview = settlementPreview(ledger, outcome);
  const pool = ledger.reduce((s, p) => s + p.stake, 0);
  const rows = markets
    .map((base) => getMarket(base.id) ?? base)
    .filter((x) => x.state !== "settled" && expiryBucket(x.closesAt, now) === filter);
  const settle = () => {
    if (!m || m.state === "settled" || !settlementGuard(verified, confirmation) || !outcome) return;
    ledger.forEach((p) =>
      outcome === "VOID" ? voidPosition(p.id) : settlePosition(p.id, p.outcome === outcome),
    );
    setMarketLifecycle(mid, {
      state: "settled",
      finalOutcome: outcome === "VOID" ? "VOID / REFUND" : outcome,
    });
    setAdmin((s) => ({
      resolutions: {
        ...s.resolutions,
        [mid]: { marketId: mid, outcome, markedAt: Date.now(), final: true, challenges: [] },
      },
    }));
    record({ market: mid, rake: preview.rake, payout: preview.payout });
    setGuard(false);
  };
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Expiry & settlement clock</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["expired", "Expired · awaiting gavel"],
            ["soon", "Closing soon · <24h"],
            ["scheduled", "Scheduled"],
          ].map(([id, label]) => (
            <Button
              key={id}
              variant={filter === id ? "secondary" : "ghost"}
              onClick={() => setFilter(id ?? "expired")}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="divide-y">
          {rows.map((x) => {
            const seconds = Math.max(0, Math.floor(((x.closesAt ?? now) - now) / 1000));
            const clock = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
            return (
              <div key={x.id} className="flex flex-wrap items-center gap-3 py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <Button
                    className="h-auto whitespace-normal p-0 text-left"
                    variant="link"
                    onClick={() => setMid(x.id)}
                  >
                    {x.question}
                  </Button>
                  <p className="num mt-1 text-xs text-muted-foreground">
                    {x.closesAt
                      ? x.closesAt <= now
                        ? "Expired"
                        : clock
                      : "Close time not supplied"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {([2, 6, 24] as const).map((h) => (
                    <Button
                      key={h}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        editMarket(x.id, { closesAt: extendMarketClose(x.closesAt, now, h) })
                      }
                    >
                      +{h}h
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
          {!rows.length && (
            <p className="py-6 text-sm text-muted-foreground">No markets in this queue.</p>
          )}
        </div>
      </section>
      <section className="border-t pt-6">
        <h2 className="mb-4 text-lg font-semibold">Live exposure & traders ledger</h2>
        <select
          aria-label="Exposure market"
          className="input-field"
          value={mid}
          onChange={(e) => setMid(e.target.value)}
        >
          {markets.map((x) => (
            <option key={x.id} value={x.id}>
              {x.question}
            </option>
          ))}
        </select>
        {m && (
          <>
            <div className="grid gap-x-6 sm:grid-cols-3">
              <Metric label="Total session pool" value={fmtKES(pool)} />
              <Metric
                label="Maximum payout liability · quoted odds"
                value={fmtKES(
                  Math.max(0, ...m.outcomes.map((o) => settlementPreview(ledger, o.label).payout)),
                )}
              />
              <Metric label="Market state" value={m.state ?? "open"} />
            </div>
            <div className="my-4 flex flex-wrap gap-4">
              {m.outcomes.map((o) => (
                <span key={o.id} className="text-xs">
                  {o.label}:{" "}
                  <b className="num">
                    {fmtKES(
                      ledger.filter((p) => p.outcome === o.label).reduce((s, p) => s + p.stake, 0),
                    )}
                  </b>
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    {[
                      "Trader handle",
                      "Phone (254…)",
                      "Outcome",
                      "Stake (KES)",
                      "Odds",
                      "Potential payout",
                      "Timestamp",
                    ].map((h) => (
                      <th className="py-3" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-3">@{user?.handle}</td>
                      <td>{user?.phone || "Not supplied"}</td>
                      <td>{p.outcome}</td>
                      <td className="num">{fmtKES(p.stake)}</td>
                      <td className="num">{p.mult.toFixed(2)}x</td>
                      <td className="num">{fmtKES(p.stake * p.mult, 2)}</td>
                      <td>{p.placedAt ? fmtDateTime(p.placedAt) : p.placed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!ledger.length && (
              <p className="my-4 text-xs text-muted-foreground">
                No open positions in this session.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  exportLedger(`polka-${mid}-ledger.csv`, [
                    [
                      "Trader",
                      "Phone",
                      "Outcome",
                      "Stake KES",
                      "Odds",
                      "Potential payout",
                      "Timestamp",
                    ],
                    ...ledger.map((p) => [
                      user?.handle ?? "",
                      user?.phone ?? "",
                      p.outcome,
                      p.stake,
                      p.mult,
                      p.stake * p.mult,
                      p.placedAt ? fmtDateTime(p.placedAt) : p.placed,
                    ]),
                  ])
                }
              >
                <Download />
                Export ledger (CSV)
              </Button>
              <Button
                disabled={m.state === "settled"}
                onClick={() => {
                  setOutcome(m.outcomes[0]?.label ?? "");
                  setVerified(false);
                  setConfirmation("");
                  setGuard(true);
                }}
              >
                <Gavel />
                Settle market
              </Button>
            </div>
          </>
        )}
      </section>
      <Dialog open={guard} onOpenChange={setGuard}>
        <DialogContent>
          <DialogTitle>Settlement confirmation</DialogTitle>
          <DialogDescription>
            Preview settlement credits this session wallet only. Verify the official result before
            dispatch.
          </DialogDescription>
          <select
            aria-label="Settlement outcome"
            className="input-field"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            {m?.outcomes.map((o) => (
              <option key={o.id}>{o.label}</option>
            ))}
            <option value="VOID">VOID / REFUND (100% Return)</option>
          </select>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              Winning traders<p className="num mt-2 text-lg">{preview.count ? 1 : 0}</p>
              <span className="text-muted-foreground">{preview.count} positions</span>
            </div>
            <div>
              Total payout<p className="num mt-2">{fmtKES(preview.payout, 2)}</p>
            </div>
            <div>
              5% losing-pot rake<p className="num mt-2">{fmtKES(preview.rake, 2)}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={verified} onCheckedChange={(v) => setVerified(v === true)} />I have
            verified official sources
          </label>
          <Input
            aria-label="Type CONFIRM"
            placeholder="Type CONFIRM"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <Button
            className="h-auto whitespace-normal py-3"
            disabled={!settlementGuard(verified, confirmation) || !outcome}
            onClick={settle}
          >
            <Gavel />
            Swing gavel & dispatch payouts (preview)
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CashierOperations() {
  const { cashierLog, user, pushNotif } = useStore();
  const { triggers } = useAdmin();
  const [states, setStates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const queue = cashierLog.filter((t) => t.kind === "withdraw");
  const audit = cashierLog.filter((t) =>
    `${user?.handle} ${user?.phone} ${t.receipt}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Pending M-Pesa cash-out queue</h2>
        <p className="my-2 text-xs text-muted-foreground">
          Session withdrawal receipts · release changes the review status only; no second wallet
          debit or real transfer.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead>
              <tr>
                {[
                  "Requested time",
                  "Handle",
                  "Phone",
                  "Amount",
                  "Transfer fee",
                  "Net dispatched",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="py-3 text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.map((t) => {
                const quote = cashierQuote(t.amount, false);
                const status = states[t.id] ?? "pending";
                return (
                  <tr key={t.id} className="border-t">
                    <td className="py-4">{fmtDateTime(t.at)}</td>
                    <td>@{user?.handle}</td>
                    <td>{user?.phone || "Not supplied"}</td>
                    <td>{fmtKES(t.amount)}</td>
                    <td>{fmtKES(quote.fee)}</td>
                    <td>{fmtKES(quote.net)}</td>
                    <td className={status === "released" ? "text-up" : "text-chart-4"}>{status}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={status === "released"}
                          onClick={() => {
                            setStates((s) => ({ ...s, [t.id]: "released" }));
                            if (triggers.withdrawal)
                              pushNotif({
                                kind: "mpesa",
                                title: "Withdrawal dispatched (preview)",
                                body: `${fmtKES(quote.net)} · ${t.receipt}`,
                              });
                          }}
                        >
                          Release via M-Pesa (preview)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={status === "released"}
                          onClick={() =>
                            setStates((s) => ({
                              ...s,
                              [t.id]: status === "held" ? "pending" : "held",
                            }))
                          }
                        >
                          {status === "held" ? "Resume review" : "Flag / hold"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!queue.length && (
          <p className="py-6 text-sm text-muted-foreground">No session cash-out requests.</p>
        )}
      </section>
      <section className="border-t pt-6">
        <h2 className="mb-4 text-lg font-semibold">Transaction audit feed</h2>
        <Input
          aria-label="Search transaction audit"
          placeholder="Phone, handle or M-Pesa reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-4 divide-y">
          {audit.map((t) => (
            <div key={t.id} className="flex flex-wrap justify-between gap-2 py-3 text-xs">
              <span>
                {fmtDateTime(t.at)} · @{user?.handle} · {user?.phone || "No phone"}
              </span>
              <span>
                {t.receipt} · {t.kind} · {fmtKES(t.amount)}
              </span>
            </div>
          ))}
        </div>
        {!audit.length && (
          <p className="py-6 text-xs text-muted-foreground">No matching transactions.</p>
        )}
        <Button
          variant="outline"
          onClick={() =>
            exportLedger("polka-transactions.csv", [
              ["Time", "Handle", "Phone", "Reference", "Kind", "KES"],
              ...audit.map((t) => [
                fmtDateTime(t.at),
                user?.handle ?? "",
                user?.phone ?? "",
                t.receipt,
                t.kind,
                t.amount,
              ]),
            ])
          }
        >
          <Download />
          Export audit CSV
        </Button>
      </section>
    </div>
  );
}

export function BroadcastOperations() {
  const { alert, triggers } = useAdmin();
  const [text, setText] = useState(alert?.text ?? "");
  const [tone, setTone] = useState<"amber" | "red">(alert?.tone ?? "amber");
  const [tutorial, setTutorial] = useState<"home" | "flash" | null>(null);
  const [run, setRun] = useState(0);
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Global status broadcast</h2>
      <Input
        aria-label="Broadcast message"
        placeholder="Platform alert"
        maxLength={240}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tone === "amber" ? "secondary" : "outline"}
          onClick={() => setTone("amber")}
        >
          Amber · maintenance
        </Button>
        <Button variant={tone === "red" ? "destructive" : "outline"} onClick={() => setTone("red")}>
          Red · incident
        </Button>
        <Button
          disabled={!text.trim()}
          onClick={() => setAdmin({ alert: { text: text.trim(), tone } })}
        >
          <Radio />
          Dispatch banner
        </Button>
        <Button variant="outline" onClick={() => setAdmin({ alert: null })}>
          Clear banner
        </Button>
      </div>
      <div className="border-t pt-5">
        <h2 className="mb-4 font-semibold">Automated notification triggers</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["won", "Market won"],
              ["voided", "Market voided"],
              ["withdrawal", "Withdrawal dispatched"],
              ["account", "Account actions"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={triggers[key]}
                onCheckedChange={(v) => setAdmin({ triggers: { ...triggers, [key]: v === true } })}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="border-t pt-5">
        <h2 className="mb-4 font-semibold">Tutorial management</h2>
        {(["home", "flash"] as const).map((variant) => (
          <div key={variant} className="mb-3 flex flex-wrap items-center gap-3">
            <span className="w-20 text-sm capitalize">{variant}</span>
            <Button
              variant="outline"
              onClick={() => {
                setTutorial(variant);
                setRun((n) => n + 1);
              }}
            >
              <Play />
              Preview
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem(
                  variant === "flash" ? "polka-seen-flash-tutorial" : "polka_onboarded_home",
                );
                setTutorial(variant);
                setRun((n) => n + 1);
              }}
            >
              <RotateCcw />
              Reset onboarding
            </Button>
          </div>
        ))}
      </div>
      {tutorial && <Tutorial key={`${tutorial}-${run}`} variant={tutorial} forceOpen />}
    </section>
  );
}
