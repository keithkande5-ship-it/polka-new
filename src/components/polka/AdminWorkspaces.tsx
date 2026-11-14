import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Pause, Play, Search, Snowflake, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Btn3D } from "@/components/polka/ui";
import { useStore } from "@/lib/store";
import { fmtDateTime, fmtKES, markets } from "@/lib/markets";
import { clearAnalytics, rank, useAnalytics } from "@/lib/analytics";
import { ISSUE_CATEGORIES, setIssueStatus, useIssues, type IssueStatus } from "@/lib/issues";
import { reviewBonusClaim, useBonusClaims, useCommissions } from "@/lib/referrals";

import { zeroFeeRemainingMs } from "@/lib/trading-rules";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin";

const card = "rounded-lg border bg-card p-4";

type DirUser = {
  handle: string;
  phone: string;
  joined: number;
  volume: number;
  balance: number;
  referredBy?: string | undefined;
  frozen: boolean;
  zeroFeeUntil?: number;
  device: "iOS" | "Android" | "Desktop";
  region: "Kenya" | "Diaspora";
};

const DAY = 86_400_000;
const seedUsers = (): DirUser[] => [];


function Stat({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  return (
    <div className={card}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 text-xl font-bold", tone)}>{value}</p>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  tone = "bg-up",
}: {
  label: string;
  value: number;
  max: number;
  tone?: string;
}) {
  return (
    <div className="text-xs">
      <div className="flex justify-between">
        <span className="truncate">{label}</span>
        <span className="num">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full", tone)}
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function csv(name: string, rows: (string | number)[][]) {
  const body = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = name;
  a.click();
}

export function UsersWorkspace() {
  const { user, balance, positions, pushNotif } = useStore();
  const { flags, triggers } = useAdmin();
  const [users, setUsers] = useState<DirUser[]>(seedUsers);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "frozen" | "referred" | "new">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [adj, setAdj] = useState("");
  const now = Date.now();
  const all = useMemo(() => {
    const me: DirUser[] = user
      ? [
          {
            handle: user.handle,
            phone: "this session",
            joined: user.joinedAt ?? now,
            volume: 0,
            balance,
            referredBy: user.referredBy,
            frozen: false,
            device: "Desktop",
            region: "Kenya",
          },
        ]
      : [];
    return [...me, ...users.filter((u) => u.handle !== user?.handle)];
  }, [users, user, balance, now]);
  const list = all.filter((u) => {
    if (q && !`${u.handle} ${u.phone}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "frozen") return u.frozen;
    if (filter === "referred") return !!u.referredBy;
    if (filter === "new") return now - u.joined < 7 * DAY;
    return true;
  });
  const patch = (h: string, p: Partial<DirUser>) => {
    setUsers((us) => us.map((u) => (u.handle === h ? { ...u, ...p } : u)));
    if (triggers.account)
      pushNotif({
        kind: "info",
        title: "Account action (preview)",
        body: `@${h} · ${p.frozen !== undefined ? (p.frozen ? "Directory account frozen" : "Directory account restored") : "Directory account updated"}`,
      });
  };
  const sel = all.find((u) => u.handle === open);
  const kenya = all.filter((u) => u.region === "Kenya").length;
  const devices = (["Android", "iOS", "Desktop"] as const).map(
    (d) => [d, all.filter((u) => u.device === d).length] as const,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered (preview)" value={String(all.length)} />
        <Stat label="Kenya / Diaspora" value={`${kenya} / ${all.length - kenya}`} />
        <Stat
          label="Referred accounts"
          value={String(all.filter((u) => u.referredBy).length)}
          tone="text-rewards"
        />
        <Stat label="Frozen" value={String(all.filter((u) => u.frozen).length)} tone="text-down" />
      </div>
      <div className={card}>
        <p className="mb-2 text-sm font-semibold">Device split</p>
        <div className="space-y-2">
          {devices.map(([d, n]) => (
            <Bar key={d} label={d} value={n} max={all.length} />
          ))}
        </div>
      </div>
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search handle or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {(["all", "new", "referred", "frozen"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs capitalize",
                filter === f && "bg-foreground text-background",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2">Trader</th>
                <th>Joined</th>
                <th>Volume</th>
                <th>Win rate</th>
                <th>Balance</th>
                <th>Fees</th>
                <th>Status / risk</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const zf = Math.max(
                  zeroFeeRemainingMs(
                    u.referredBy ? { referredBy: u.referredBy, joinedAt: u.joined } : null,
                    now,
                  ),
                  (u.zeroFeeUntil ?? 0) - now,
                );
                return (
                  <tr
                    key={u.handle}
                    className="cursor-pointer border-t hover:bg-muted/40"
                    onClick={() => setOpen(u.handle)}
                  >
                    <td className="py-2 font-medium">
                      @{u.handle}
                      <span className="block text-muted-foreground">{u.phone}</span>
                    </td>
                    <td className="num">{fmtDateTime(u.joined)}</td>
                    <td className="num">{fmtKES(u.volume)}</td>
                    <td className="num text-muted-foreground">
                      {u.phone === "this session" &&
                      positions.some((p) => p.status === "won" || p.status === "lost")
                        ? `${Math.round((positions.filter((p) => p.status === "won").length / positions.filter((p) => p.status === "won" || p.status === "lost").length) * 100)}%`
                        : "Not recorded"}
                    </td>
                    <td className="num">{fmtKES(u.balance)}</td>
                    <td>
                      {zf > 0 ? (
                        <span className="text-up">0% · {Math.ceil(zf / 3_600_000)}h</span>
                      ) : (
                        "5% rake"
                      )}
                    </td>
                    <td>
                      {u.frozen ? <span className="text-down">Frozen</span> : "Active"}
                      {flags
                        .filter((f) => f.user.includes(u.handle))
                        .map((f) => (
                          <span key={f.id} className="block text-chart-4">
                            {f.kind}
                          </span>
                        ))}
                    </td>
                    <td>
                      <Button size="sm" variant="outline" onClick={() => setOpen(u.handle)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!list.length && (
            <p className="py-4 text-center text-xs text-muted-foreground">No traders match.</p>
          )}
        </div>
      </div>
      {sel && (
        <div className={cn(card, "space-y-3 border-primary/40")}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">@{sel.handle}</p>
            <button className="ml-auto text-xs underline" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Referred by {sel.referredBy ? `@${sel.referredBy}` : "nobody"} · invited:{" "}
            {all
              .filter((u) => u.referredBy === sel.handle)
              .map((u) => `@${u.handle}`)
              .join(", ") || "none"}
          </p>
          <ReferrerEarnings handle={sel.handle} />
          {sel.phone === "this session" ? (
            <p className="text-xs text-muted-foreground">
              Your own preview session — controls apply to directory accounts.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Btn3D
                className="h-9 px-3 text-xs"
                onClick={() => {
                  patch(sel.handle, { frozen: !sel.frozen });
                  toast(sel.frozen ? "Trading restored" : "Account frozen (preview)");
                }}
              >
                <Snowflake className="h-3.5 w-3.5" /> {sel.frozen ? "Unfreeze" : "Freeze"}
              </Btn3D>
              <Button
                variant="outline"
                onClick={() => {
                  if (triggers.account)
                    pushNotif({
                      kind: "info",
                      title: "PIN reset requested (preview)",
                      body: `@${sel.handle} · no SMS sent`,
                    });
                  toast("PIN reset requested (preview) · no SMS sent");
                }}
              >
                Reset PIN
              </Button>
              <Btn3D
                className="h-9 px-3 text-xs"
                onClick={() => {
                  patch(sel.handle, { zeroFeeUntil: Date.now() + DAY });
                  toast("24h zero-fee window granted (preview)");
                }}
              >
                Grant 24h 0% fees
              </Btn3D>
              <Input
                className="h-9 w-32"
                type="number"
                placeholder="± KES"
                value={adj}
                onChange={(e) => setAdj(e.target.value)}
              />
              <Btn3D
                className="h-9 px-3 text-xs"
                onClick={() => {
                  const n = Number(adj);
                  if (!Number.isFinite(n) || !n) return toast.error("Enter an amount");
                  patch(sel.handle, { balance: Math.max(0, sel.balance + n) });
                  setAdj("");
                  toast.success(`Balance adjusted ${n > 0 ? "+" : ""}${fmtKES(n)} (preview)`);
                  return undefined;
                }}
              >
                Adjust balance
              </Btn3D>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReferrerEarnings({ handle }: { handle: string }) {
  const ledger = useCommissions(handle);
  const total = ledger.reduce((a, c) => a + c.amount, 0);
  return (
    <p className="num text-xs">
      Recorded referral commission: <b className="text-up">{fmtKES(total, 2)}</b> across{" "}
      {ledger.length} trades
    </p>
  );
}

export function TrafficWorkspace() {
  const events = useAnalytics();
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(events);
  const stream = paused ? frozen : events;
  const views = rank(events, "view").slice(0, 10);
  const clicks = rank(events, "click").slice(0, 10);
  const hour = events.filter((e) => Date.now() - e.at < 3_600_000).length;
  const marketRows = markets
    .map((m) => {
      const v = events.filter((e) => e.kind === "view" && e.name === `/market/${m.id}`).length;
      const t = events.filter((e) => e.kind === "click" && e.path === `/market/${m.id}`).length;
      return { m, v, t };
    })
    .filter((r) => r.v)
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Preview telemetry recorded in this browser only — not real site-wide traffic.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Events recorded" value={String(events.length)} />
        <Stat label="Last hour" value={String(hour)} />
        <Stat label="Page views" value={String(events.filter((e) => e.kind === "view").length)} />
        <Stat
          label="Trade clicks"
          value={String(events.filter((e) => e.kind === "click").length)}
          tone="text-up"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(card, "space-y-2")}>
          <p className="text-sm font-semibold">Most visited pages</p>
          {views.length ? (
            views.map(([n, c]) => <Bar key={n} label={n} value={c} max={views[0]?.[1] ?? 0} />)
          ) : (
            <p className="text-xs text-muted-foreground">No views yet.</p>
          )}
        </div>
        <div className={cn(card, "space-y-2")}>
          <p className="text-sm font-semibold">Most clicked actions</p>
          {clicks.length ? (
            clicks.map(([n, c]) => (
              <Bar key={n} label={n} value={c} max={clicks[0]?.[1] ?? 0} tone="bg-rewards" />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No trades placed yet.</p>
          )}
        </div>
      </div>
      <div className={card}>
        <p className="mb-2 text-sm font-semibold">Market funnel (views → trades)</p>
        {marketRows.length ? (
          marketRows.map(({ m, v, t }) => (
            <div
              key={m.id}
              className="flex items-center gap-3 border-t py-2 text-xs first:border-0"
            >
              <span className="min-w-0 flex-1 truncate">{m.question}</span>
              <span className="num">{v} views</span>
              <span className="num">{t} trades</span>
              <span className="num w-12 text-right text-up">{Math.round((t / v) * 100)}%</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Open some market pages to populate the funnel.
          </p>
        )}
      </div>
      <div className={card}>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm font-semibold">Live event stream</p>
          <Btn3D
            className="ml-auto h-8 px-3 text-xs"
            onClick={() => {
              setFrozen(events);
              setPaused(!paused);
            }}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{" "}
            {paused ? "Resume" : "Pause"}
          </Btn3D>
          <Btn3D
            className="h-8 px-3 text-xs"
            onClick={() =>
              csv("polka-traffic.csv", [
                ["time", "kind", "name", "path"],
                ...events.map((e) => [new Date(e.at).toISOString(), e.kind, e.name, e.path]),
              ])
            }
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Btn3D>
          <Btn3D
            className="h-8 px-3 text-xs"
            onClick={() => {
              clearAnalytics();
              toast("Telemetry cleared");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Btn3D>
        </div>
        <div className="max-h-72 overflow-y-auto text-xs">
          {stream.slice(0, 100).map((e) => (
            <p key={e.id} className="num flex gap-3 border-t py-1.5">
              <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
              <span className={e.kind === "click" ? "text-rewards" : "text-muted-foreground"}>
                {e.kind}
              </span>
              <span className="truncate">{e.name}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const STATUS: { id: IssueStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "investigating", label: "In review" },
  { id: "resolved", label: "Resolved" },
];

export function IssuesWorkspace() {
  const issues = useIssues();
  const { adjustBalance } = useStore();
  const [tab, setTab] = useState<IssueStatus>("open");
  const [cat, setCat] = useState<string>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const list = issues.filter((i) => i.status === tab && (cat === "all" || i.category === cat));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {STATUS.map((s) => (
          <Stat
            key={s.id}
            label={s.label}
            value={String(issues.filter((i) => i.status === s.id).length)}
            tone={s.id === "open" ? "text-down" : undefined}
          />
        ))}
      </div>
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS.map((s) => (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                tab === s.id && "bg-foreground text-background",
              )}
            >
              {s.label}
            </button>
          ))}
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="all">All categories</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <Btn3D
            className="ml-auto h-8 px-3 text-xs"
            onClick={() =>
              csv("polka-issues.csv", [
                [
                  "id",
                  "created",
                  "category",
                  "status",
                  "reference",
                  "contact",
                  "page",
                  "description",
                ],
                ...issues.map((i) => [
                  i.id,
                  new Date(i.createdAt).toISOString(),
                  i.category,
                  i.status,
                  i.reference ?? "",
                  i.contact ?? "",
                  i.page,
                  i.description,
                ]),
              ])
            }
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Btn3D>
        </div>
        <div className="mt-3 space-y-3">
          {list.map((i) => (
            <div key={i.id} className="rounded-lg border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num font-semibold">{i.id}</span>
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {ISSUE_CATEGORIES.find((c) => c.id === i.category)?.label}
                </span>
                <span className="text-muted-foreground">
                  {fmtDateTime(i.createdAt)} · {i.page}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{i.description}</p>
              <p className="mt-1 text-muted-foreground">
                Ref: {i.reference || "—"} · Contact: {i.contact || "—"}
              </p>
              <Textarea
                className="mt-2 text-xs"
                placeholder="Staff note (kept in this session)"
                value={notes[i.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS.filter((s) => s.id !== i.status).map((s) => (
                  <Btn3D
                    key={s.id}
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      setIssueStatus(i.id, s.id);
                      toast(`${i.id} → ${s.label}`);
                    }}
                  >
                    Mark {s.label.toLowerCase()}
                  </Btn3D>
                ))}
                {i.category === "mpesa" && i.status !== "resolved" && (
                  <Btn3D
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      adjustBalance(100);
                      setIssueStatus(i.id, "resolved");
                      toast.success("KES 100 goodwill refund credited to the preview wallet");
                    }}
                  >
                    Refund KES 100 &amp; resolve
                  </Btn3D>
                )}
              </div>
            </div>
          ))}
          {!list.length && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nothing in this queue. Reports from the footer “Report an issue” box appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
