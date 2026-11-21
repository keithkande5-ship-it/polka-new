import { vaultPost, getVault } from "@/lib/trading-rules";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ShieldAlert,
  Download,
  Activity,
  Snowflake,
  ImagePlus,
  Menu,
  Landmark,
  LayoutDashboard,
  Users,
  Radio,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Btn3D } from "@/components/polka/ui";
import {
  IssuesWorkspace,
  TrafficWorkspace,
  UsersWorkspace,
} from "@/components/polka/AdminWorkspaces";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CommandProvider,
  Treasury,
  MarketOperations,
  CashierOperations,
  BroadcastOperations,
} from "@/components/polka/AdminCommandCenter";
import { useStore } from "@/lib/store";
import { setAdmin, useAdmin } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import {
  addCategory,
  addMarket,
  editMarket,
  getMarket,
  fmtKES,
  markets,
  payout,
  useCategories,
  useMarketsVersion,
} from "@/lib/markets";
import { assets, useLivePrice, useRound } from "@/lib/crypto";
import {
  DEFAULT_MARKET_SEED,
  DEFAULT_RAKE,
  MAX_RAKE,
  WITHDRAWAL_APPROVAL_THRESHOLD,
  flashMultipliers,
  needsWithdrawalApproval,
  platformRake,
  seedSplit,
  setRake,
  useRake,
} from "@/lib/trading-rules";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    ops: String(search["ops"]) === "1" ? "1" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin workspace | Polka" },
      {
        name: "description",
        content:
          "Polka operator workspace for markets, settlement, cashier, risk and site settings.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin workspace | Polka" },
      { property: "og:description", content: "Polka operator workspace (preview)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const card = "rounded-lg border bg-card p-4";
const workspaces = [
  { id: "treasury", label: "Treasury & Float", icon: Landmark },
  { id: "markets", label: "Markets Desk", icon: LayoutDashboard },
  { id: "cashier", label: "Cashier & Payouts", icon: Download },
  { id: "traders", label: "Traders & Risk", icon: Users },
  { id: "comms", label: "Broadcast & Comms", icon: Radio },
];
function Admin() {
  const { openAuth } = useStore();
  const [active, setActive] = useState("treasury");
  const [drawer, setDrawer] = useState(false);
  const [role, setRole] = useState<"operator" | "finance" | "super_admin" | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      setAccessChecked(false);
      setRole(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          if (active) setAccessChecked(true);
          return;
        }
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id);
        if (!active) return;
        if (error) {
          toast.error("Could not verify operator access. Please try again.");
        } else if (data?.length) {
          const roles = data.map((row) => row.role);
          setRole(roles.includes("super_admin") ? "super_admin" : roles.includes("finance") ? "finance" : "operator");
        }
        setAccessChecked(true);
      } catch {
        if (!active) return;
        toast.error("Could not verify operator access. Please try again.");
        setAccessChecked(true);
      }
    };
    void checkAccess();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (active) window.setTimeout(() => { if (active) void checkAccess(); }, 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!accessChecked)
    return <div className="mx-auto max-w-sm px-5 py-20 text-sm text-muted-foreground">Verifying operator access…</div>;
  if (!role)
    return (
      <div className="mx-auto max-w-sm px-5 py-20">
        <h1 className="text-2xl font-semibold">Operator access</h1>
        <p className="my-4 text-sm text-muted-foreground">
          A signed-in account with an assigned Polka staff role is required to access this workspace.
        </p>
        <Button onClick={() => openAuth()}>Sign in</Button>
      </div>
    );
  const nav = (
    <>
      <div className="mb-8 border-b border-sidebar-border pb-6">
        <img src="/logo-white.png" alt="Polka" className="h-12 w-28 object-contain" />
        <p className="mt-3 text-xs font-semibold uppercase text-sidebar-foreground">
          Admin command center
        </p>
        <p className="mt-3 text-[10px] text-up">
          ● {role.replace("_", " ").toUpperCase()}
        </p>
      </div>
      <nav aria-label="Admin workspaces" className="space-y-2">
        {workspaces.map((w) => (
          <Button
            key={w.id}
            variant="ghost"
            aria-current={active === w.id ? "page" : undefined}
            className={`h-12 w-full justify-start text-xs ${active === w.id ? "bg-sidebar-accent text-sidebar-foreground border-l-2 border-up" : "text-muted-foreground"}`}
            onClick={() => {
              setActive(w.id);
              setDrawer(false);
            }}
          >
            <w.icon />
            {w.label}
          </Button>
        ))}
      </nav>
      <div className="mt-8 space-y-3 border-t pt-5">
        <Button variant="ghost" asChild className="w-full justify-start text-xs">
          <Link to="/">
            <ArrowLeft />
            Public markets
          </Link>
        </Button>
      </div>
    </>
  );
  return (
    <CommandProvider>
      <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto border-r border-sidebar-border bg-sidebar p-5 font-mono md:block">
          {nav}
        </aside>
        <div className="min-w-0 md:ml-64">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-8">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open admin navigation"
              className="md:hidden"
              onClick={() => setDrawer(true)}
            >
              <Menu />
            </Button>
            <h1 className="text-lg font-semibold">
              {workspaces.find((w) => w.id === active)?.label}
            </h1>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">STAFF WORKSPACE</span>
          </header>
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
            <div className={active === "treasury" ? "" : "hidden"}>
              <Treasury />
              <div className="mt-8">
                <Overview />
              </div>
            </div>
            <div className={active === "markets" ? "space-y-8" : "hidden"}>
              <Studio />
              <MarketOperations />
            </div>
            <div className={active === "cashier" ? "space-y-8" : "hidden"}>
              <CashierOperations />
              <Cashier />
            </div>
            <div className={active === "traders" ? "space-y-8" : "hidden"}>
              <UsersWorkspace />
              <Risk />
              <IssuesWorkspace />
              <TrafficWorkspace />
            </div>
            <div className={active === "comms" ? "space-y-8" : "hidden"}>
              <BroadcastOperations />
              <Site />
            </div>
          </div>
        </div>
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="w-64 overflow-y-auto bg-sidebar font-mono">
            <SheetTitle className="sr-only">Admin workspaces</SheetTitle>
            <SheetDescription className="sr-only">
              Choose one of five operator workspaces
            </SheetDescription>
            {nav}
          </SheetContent>
        </Sheet>
      </div>
    </CommandProvider>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={card}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Overview() {
  useMarketsVersion();
  const { positions } = useStore();
  const { flags, resolutions } = useAdmin();
  const { status } = useLivePrice(
    assets[0] ?? { sym: "BTC", name: "Bitcoin", seed: 108000, decimals: 2, binance: "btcusdt" },
  );
  const { remaining } = useRound();
  const volume = markets.reduce((a, m) => a + m.volume, 0);
  const open = positions.filter((p) => p.status === "open").length;
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Stat label="Total traded volume" value={fmtKES(volume)} />
      <Stat label="Open positions (this session)" value={String(open)} />
      <Stat label="Flash round closes in" value={`${remaining}s`} />
      <Stat
        label="BTC price feed"
        value={status === "live" ? "Live" : status === "stale" ? "Reconnecting" : "Disconnected"}
        tone={status === "live" ? "text-up" : status === "stale" ? "text-chart-4" : "text-down"}
      />
      <Stat label="Listed markets" value={String(markets.length)} />
      <Stat
        label="In dispute window"
        value={String(Object.values(resolutions).filter((r) => !r.final).length)}
      />
      <Stat
        label="Open risk flags"
        value={String(flags.filter((f) => !f.frozen).length)}
        tone="text-down"
      />
      <Stat label="System" value="Preview mode" />
    </div>
  );
}

const MAX_OUTCOMES = 8;

function CrestUploader({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string | null;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground hover:border-primary">
      {value ? (
        <img src={value} alt="" className="h-12 w-12 object-contain" />
      ) : (
        <ImagePlus className="h-5 w-5" />
      )}
      <span className="font-semibold text-foreground">{label}</span>
      <span>{value ? "Tap to replace" : "PNG · JPG · SVG, up to 2 MB"}</span>
      <input type="file" accept="image/*" className="hidden" onChange={onPick} />
    </label>
  );
}

function Studio() {
  useMarketsVersion();
  const [editing, setEditing] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [featured, setFeatured] = useState(false);
  const [rules, setRules] = useState("");
  const cats = useCategories().filter((c) => c !== "All");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(cats[0] ?? "Politics");
  const [customCat, setCustomCat] = useState("");
  const [labels, setLabels] = useState(["Yes", "No"]);
  const [outImgs, setOutImgs] = useState<string[]>([]);
  const [sportOn, setSportOn] = useState(false);
  const [league, setLeague] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [homeCrest, setHomeCrest] = useState<string | null>(null);
  const [awayCrest, setAwayCrest] = useState<string | null>(null);
  const [seed, setSeed] = useState(DEFAULT_MARKET_SEED);
  const [closes, setCloses] = useState("");
  const [source, setSource] = useState("");
  const isCustom = cat === "__custom";
  const n = labels.length;
  const split = seedSplit(seed, n);

  const readCrest = (set: (v: string | null) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 2_000_000) {
      toast.error("Choose an image under 2 MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => set(String(r.result));
    r.readAsDataURL(f);
  };

  const addOutcome = () =>
    n < MAX_OUTCOMES && setLabels((ls) => [...ls, `Outcome ${ls.length + 1}`]);
  const removeOutcome = (i: number) => n > 2 && setLabels((ls) => ls.filter((_, j) => j !== i));

  const load = (id: string) => {
    setEditing(id);
    const m = getMarket(id);
    if (!m) {
      setQ("");
      setImage(null);
      setFeatured(false);
      setRules("");
      setSource("");
      setCloses("");
      return;
    }
    setQ(m.question);
    setCat(m.category);
    setLabels(m.outcomes.map((o) => o.label));
    setSource(m.oracle);
    setRules(m.rules);
    setImage(m.thumb.img ?? null);
    setFeatured(m.featured ?? !!m.hot);
    setCloses(
      m.closesAt
        ? new Date(m.closesAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : "",
    );
  };
  const create = () => {
    const chosen = (isCustom ? customCat : cat).trim();
    if (q.trim().length < 10) return toast.error("Write the full event question.");
    if (!chosen) return toast.error("Pick or type a category.");
    if (!closes) return toast.error("Set a resolution date.");
    if (!Number.isFinite(Date.parse(closes))) return toast.error("Choose a valid close date.");
    if (image && !/^(https?:\/\/|data:image\/)/.test(image))
      return toast.error("Choose an image file or an HTTP image URL.");
       if (editing) {
      const existing = markets.find((m) => m.id === editing);
      if (!existing) return toast.error("Market no longer exists.");
      addCategory(chosen);
      editMarket(editing, {
        question: q.trim(),
        category: chosen,
        closesAt: Date.parse(closes),
        endsLabel: new Date(closes).toLocaleDateString("en-KE"),
        featured,
        ...(rules.trim() ? { rules: rules.trim() } : {}),
        ...(source.trim() ? { oracle: source.trim() } : {}),
        thumb: { ...existing.thumb, img: image ?? undefined },
      });
      void supabase.from("markets").update({
        title: q.trim(),
        category: chosen,
        closes_at: closes ? new Date(closes).toISOString() : null,
        ends: closes ? new Date(closes).toLocaleDateString("en-KE") : existing.endsLabel,
        featured,
        rules: rules.trim() || undefined,
        oracle: source.trim() || undefined,
        image: image ?? null,
        thumb: { ...existing.thumb, img: image ?? undefined },
      }).eq("id", editing).then(({ error }) => {
        if (error) toast.error("Database error updating market: " + error.message);
        else toast.success("Market updated live in database across all devices!");
      });
      return;
    }

    if (source.trim().length < 3) return toast.error("Add the verification source (URL or official body).");
    if (rules.trim().length < 20) return toast.error("Write the resolution rules (at least 20 characters).");
    if (sportOn && (!league.trim() || !home.trim() || !away.trim()))
      return toast.error("Fill in the league and both team names.");
    if (outImgs.some((u) => u && !/^https?:\/\//.test(u)))
      return toast.error("Outcome photos must be HTTP image URLs.");
    if (!vaultPost("seed", -seed, `Seed · ${q.trim().slice(0, 40)}`))
      return toast.error(`Vault has ${fmtKES(getVault().balance)} — not enough to seed ${fmtKES(seed)}.`);
    if (isCustom) addCategory(chosen);
    const id =
      q
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 48) +
      "-" +
      Date.now().toString(36);
     const marketPayload = {
      id,
      title: q.trim(),
      category: chosen,
      image: image ?? null,
      thumb: {
        text: sportOn
          ? `${home.trim()[0] ?? "H"}${away.trim()[0] ?? "A"}`.toUpperCase()
          : q.trim().slice(0, 2).toUpperCase(),
        tone: "primary" as const,
        img: image ?? undefined,
      },
      seed,
      traded: seed,
      closes_at: new Date(closes).toISOString(),
      featured,
      is_public: true,
      state: "open",
      resolved: false,
      ends: new Date(closes).toLocaleDateString("en-KE", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      outcomes: labels.map((l, i) => ({
        id: `o${i}`,
        label: l.trim() || `Outcome ${i + 1}`,
        prob: Math.round((1 / n) * 1000) / 1000,
        ...(outImgs[i]?.trim() ? { img: outImgs[i]!.trim() } : {}),
      })),
      rules: rules.trim(),
      oracle: source.trim(),
    };

    void supabase
      .from("markets")
      .insert(marketPayload)
      .then(({ error }) => {
        if (error) {
          toast.error("Database error listing market: " + error.message);
          return;
        }
        addMarket({
          ...marketPayload,
          question: marketPayload.title,
          volume: seed,
          endsLabel: marketPayload.ends,
          closesAt: Date.parse(closes),
          news: [],
          comments: [],
        });
        toast.success("Market listed live on database across all devices!");
      });

    setQ("");
    setLabels(["Yes", "No"]);
    setSportOn(false);
    setLeague("");
    setHome("");
    setAway("");
    setHomeCrest(null);
    setAwayCrest(null);
    return undefined;

     
  };

  return (
    <section className={`${card} mb-4`}>
      <h2 className="font-semibold">Market studio</h2>
      <select
        aria-label="Edit existing market"
        className="input-field mt-3"
        value={editing}
        onChange={(e) => load(e.target.value)}
      >
        <option value="">Create new market</option>
        {markets.map((m) => (
          <option key={m.id} value={m.id}>
            {m.question}
          </option>
        ))}
      </select>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CrestUploader label="Thumbnail / banner" value={image} onPick={readCrest(setImage)} />
        <label className="text-xs text-muted-foreground">
          Image URL
          <Input
            aria-label="Market image URL"
            value={image?.startsWith("data:") ? "" : (image ?? "")}
            onChange={(e) => setImage(e.target.value || null)}
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={featured} onCheckedChange={(v) => setFeatured(v === true)} />
          Feature in Spotlight Carousel
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input
          placeholder="Event question"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="md:col-span-2"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
          <option value="__custom">Custom category…</option>
        </select>
        {isCustom ? (
          <Input
            placeholder="New category (added to the filter pills)"
            value={customCat}
            onChange={(e) => setCustomCat(e.target.value)}
          />
        ) : (
          <p className="self-center text-xs text-muted-foreground">
            New categories appear automatically on the market filter pills.
          </p>
        )}
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Btn3D
            variant={n === 2 ? "primary" : "surface"}
            onClick={() => setLabels(["Yes", "No"])}
            className="h-10 px-4"
          >
            2-way
          </Btn3D>
          <Btn3D
            variant={n === 3 ? "primary" : "surface"}
            onClick={() => setLabels(["Home", "Draw", "Away"])}
            className="h-10 px-4"
          >
            3-way (1X2)
          </Btn3D>
          <Btn3D
            variant={n > 3 ? "primary" : "surface"}
            onClick={addOutcome}
            disabled={n >= MAX_OUTCOMES}
            className="h-10 px-4"
          >
            + Add outcome
          </Btn3D>
          <span className="num self-center text-xs text-muted-foreground">
            {n} outcomes · equal 1/{n} opening probability
          </span>
        </div>
        {labels.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={l}
              onChange={(e) => setLabels((ls) => ls.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Outcome ${i + 1}`}
            />
            <Input
              aria-label={`Photo URL for outcome ${i + 1}`}
              value={outImgs[i] ?? ""}
              onChange={(e) => setOutImgs((xs) => { const c = [...xs]; c[i] = e.target.value; return c; })}
              placeholder="Photo URL (optional)"
              className="max-w-[40%]"
            />
            <Btn3D
              onClick={() => removeOutcome(i)}
              disabled={n <= 2}
              aria-label={`Remove outcome ${i + 1}`}
              className="h-10 w-10 shrink-0 px-0"
            >
              ×
            </Btn3D>
          </div>
        ))}
        <Btn3D
          variant={sportOn ? "primary" : "surface"}
          onClick={() => setSportOn(!sportOn)}
          className="h-10 md:col-span-2"
        >
          {sportOn ? "Sports fixture ✓" : "Sports fixture (team crests)"}
        </Btn3D>
        {sportOn && (
          <>
            <Input
              placeholder="League (e.g. FKF Premier League)"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
            />
            <Input placeholder="Competition note (optional)" />
            <Input placeholder="Home team" value={home} onChange={(e) => setHome(e.target.value)} />
            <Input placeholder="Away team" value={away} onChange={(e) => setAway(e.target.value)} />
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <CrestUploader
                label="Home crest"
                value={homeCrest}
                onPick={readCrest(setHomeCrest)}
              />
              <CrestUploader
                label="Away crest"
                value={awayCrest}
                onPick={readCrest(setAwayCrest)}
              />
            </div>
          </>
        )}
        <label className="text-xs text-muted-foreground">
          Seed liquidity (KES)
          <Input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
          />
          <span className="mt-1 block">{split.map((s) => fmtKES(s)).join(" · ")} per outcome</span>
        </label>
        <label className="text-xs text-muted-foreground">
          Resolution date
          <Input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
        </label>
        <Input
          placeholder="Verification source (URL, gazette, or official body — e.g. IEBC Gazette Notice)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="md:col-span-2"
        />
        <Textarea
          placeholder="Resolution rules & criteria — what counts as YES/NO, edge cases, void conditions"
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          className="min-h-28 md:col-span-2"
        />
      </div>
      <Btn3D variant="primary" onClick={create} className="mt-4 h-11 px-6">
        {editing ? "Save market changes" : "List market"}
      </Btn3D>
    </section>
  );
}

type Row = { date: string; ref: string; type: string; amount: number };
const sampleLedger: Row[] = [
  { date: "2026-10-01", ref: "QJK1A2B3C4", type: "C2B deposit", amount: 12_500 },
  { date: "2026-10-03", ref: "QJK5D6E7F8", type: "B2C withdrawal", amount: -4_200 },
  { date: "2026-10-07", ref: "QJL9G0H1I2", type: "C2B deposit", amount: 31_000 },
  { date: "2026-10-12", ref: "QJM3J4K5L6", type: "B2C withdrawal", amount: -15_000 },
  { date: "2026-10-18", ref: "QJN7M8N9O0", type: "C2B deposit", amount: 8_750 },
];

function TradingRulesCard() {
  const rake = useRake();
  const even = flashMultipliers(null, null);
  return (
    <section className={card}>
      <h2 className="font-semibold">Trading rules</h2>
      <p className="text-xs text-muted-foreground">
        Platform rake on Flash payouts. Changes reprice quotes, multipliers and projected payouts
        app-wide instantly. Default {Math.round(DEFAULT_RAKE * 100)}%, max{" "}
        {Math.round(MAX_RAKE * 100)}%.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Rake %
          <Input
            type="number"
            min={0}
            max={20}
            step={1}
            value={Math.round(rake * 100)}
            onChange={(e) => setRake((Number(e.target.value) || 0) / 100)}
            className="w-24"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {[0, 3, 5, 8, 10, 15].map((p) => (
            <Btn3D
              key={p}
              variant={Math.round(rake * 100) === p ? "primary" : "surface"}
              onClick={() => setRake(p / 100)}
              className="num h-9 px-2.5 text-xs"
            >
              {p}%
            </Btn3D>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Stat
          label="Even-probability multiplier"
          value={`${even.up.toFixed(2)}x / ${even.down.toFixed(2)}x`}
        />
        <Stat label="Rake on a KES 10,000 pool" value={fmtKES(platformRake(10_000))} />
        <Stat
          label="Projected KES 100 payout (even odds)"
          value={fmtKES(payout(100, even.up), 2)}
        />
      </div>
    </section>
  );
}

function Cashier() {
  useMarketsVersion();
  const exportCsv = () => {
    const lines = [
      "date,mpesa_ref,type,amount_kes,rake_kes,approval_required",
      ...sampleLedger.map(
        (r) =>
          `${r.date},${r.ref},${r.type},${r.amount},${platformRake(Math.abs(r.amount))},${needsWithdrawalApproval(-r.amount)}`,
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "polka-kra-2026-10-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-4">
      <TradingRulesCard />
      <p className="text-xs text-muted-foreground">Sample figures — M-Pesa is not connected yet.</p>
      <section className={card}>
        <div className="flex items-center">
          <h2 className="font-semibold">Sample tax export ledger</h2>
          <Btn3D onClick={exportCsv} className="ml-auto h-9 px-3">
            <Download className="mr-1 h-4 w-4" />
            KRA CSV
          </Btn3D>
        </div>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[580px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th>Date</th>
                <th>Ref</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sampleLedger.map((r) => (
                <tr key={r.ref} className="border-t">
                  <td className="py-2">{r.date}</td>
                  <td>{r.ref}</td>
                  <td>
                    {r.type}
                    {needsWithdrawalApproval(-r.amount) && (
                      <span className="ml-2 rounded bg-chart-4/15 px-1.5 text-xs text-chart-4">
                        Needs approval
                      </span>
                    )}
                  </td>
                  <td className={`text-right ${r.amount < 0 ? "text-down" : "text-up"}`}>
                    {fmtKES(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Withdrawals over {fmtKES(WITHDRAWAL_APPROVAL_THRESHOLD)} require admin approval.
        </p>
      </section>
    </div>
  );
}

function Risk() {
  const { flags } = useAdmin();
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldAlert className="h-4 w-4 text-down" /> Risk &amp; bot radar
      </h2>
      <p className="text-xs text-muted-foreground">Sample flags for preview.</p>
      <div className="mt-3 divide-y">
        {flags.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {f.user}{" "}
                <span className="text-xs font-normal text-muted-foreground">· {f.kind}</span>
              </p>
              <p className="text-xs text-muted-foreground">{f.detail}</p>
            </div>
            <Btn3D
              className="h-9 px-3"
              variant={f.frozen ? "surface" : "primary"}
              onClick={() =>
                setAdmin((s) => ({
                  flags: s.flags.map((x) => (x.id === f.id ? { ...x, frozen: !x.frozen } : x)),
                }))
              }
            >
              <Snowflake className="mr-1 h-4 w-4" />
              {f.frozen ? "Unfreeze" : "Freeze account"}
            </Btn3D>
          </div>
        ))}
      </div>
    </section>
  );
}

function Site() {
  useMarketsVersion();
  const { links, notice, news } = useAdmin();
  const [draft, setDraft] = useState(links);
  const [nmid, setNmid] = useState(markets[0]?.id ?? "");
  const [n, setN] = useState({ source: "", title: "", url: "" });
  const linkFields = useMemo(
    () =>
      [
        ["whatsapp", "WhatsApp Community invite URL"],
        ["channel", "WhatsApp Channel URL"],
        ["telegram", "Telegram Channel"],
        ["x", "X handle URL"],
        ["support", "Support desk"],
      ] as const,
    [],
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card}>
        <h2 className="font-semibold">Community links</h2>
        <div className="mt-3 space-y-2">
          {linkFields.map(([k, label]) => (
            <Input
              key={k}
              placeholder={`${label} (https://…)`}
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
            />
          ))}
        </div>
        <Btn3D
          variant="primary"
          className="mt-3 h-10 px-5"
          onClick={() => {
            if (Object.values(draft).some((v) => v && !/^https?:\/\//.test(v)))
              return toast.error("Links must start with https://");
                        setAdmin({ links: draft });
            void supabase.from("site_settings").upsert({
              key: "site_links",
              value: draft,
              is_public: true,
              updated_at: new Date().toISOString(),
            }).then(({ error }) => {
              if (error) toast.error("Database save failed: " + error.message);
              else toast.success("Community links saved live for all devices!");
            });

            return undefined;
          }}
        >
          Save links
        </Btn3D>
        <h2 className="mt-6 font-semibold">Site notice</h2>
        <Textarea
          className="mt-2"
          placeholder="Banner notice shown above the footer disclaimer"
          value={notice}
          onChange={(e) => setAdmin({ notice: e.target.value })}
        />
      </section>
      <section className={card}>
        <h2 className="font-semibold">Verified news</h2>
        <select
          value={nmid}
          onChange={(e) => setNmid(e.target.value)}
          className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {markets.map((x) => (
            <option key={x.id} value={x.id}>
              {x.question}
            </option>
          ))}
        </select>
        <div className="mt-2 space-y-2">
          <Input
            placeholder="Source (e.g. Nation)"
            value={n.source}
            onChange={(e) => setN({ ...n, source: e.target.value })}
          />
          <Input
            placeholder="Headline"
            value={n.title}
            onChange={(e) => setN({ ...n, title: e.target.value })}
          />
          <Input
            placeholder="Article link (https://…)"
            value={n.url}
            onChange={(e) => setN({ ...n, url: e.target.value })}
          />
        </div>
        <Btn3D
          variant="primary"
          className="mt-3 h-10 px-5"
          onClick={() => {
            if (!n.source || !n.title || !/^https?:\/\//.test(n.url))
              return toast.error("Fill source, headline and a https link.");
            setAdmin((s) => ({ news: [{ ...n, ago: "now", marketId: nmid }, ...s.news] }));
            setN({ source: "", title: "", url: "" });
            toast.success("Published to market page");
            return undefined;
          }}
        >
          Publish
        </Btn3D>
        <div className="mt-3 space-y-1 text-xs">
          {news.map((x, i) => (
            <p key={i}>
              <Link to="/market/$id" params={{ id: x.marketId }} className="underline">
                {x.title}
              </Link>{" "}
              · {x.source}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
