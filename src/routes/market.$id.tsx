import whatsappAsset from "@/assets/whatsapp.jpeg.asset.json";
import xAsset from "@/assets/x.png.asset.json";
import telegramAsset from "@/assets/telegram.png.asset.json";
import tiktokAsset from "@/assets/tiktok.jpeg.asset.json";
import { RulesNewsTabs } from "@/components/polka/RulesNewsTabs";
import { EatRounds, EatTargetBar } from "@/components/polka/EatPanels";
import { WhatsAppIcon } from "@/components/polka/WhatsAppIcon";
import { referralLink } from "@/lib/site";
import { useMemo, useState, useEffect, useRef } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Gavel,
  Lock,
  MessageSquare,
  ShieldCheck,
  ThumbsUp,
  Share2,
} from "lucide-react";
import {
  fmtCompact,
  fmtKES,
  fmtOutcome,
  fmtResolveEta,
  flatHistory,
  getLiveHistory,
  genHistory,
  mirrorHistory,
  getMarket,
  hashId,
  markets,
  positionResolveAt,
  useMarketsVersion,
  type Comment,
  type Market,
  type Proposed,
  toMultiplier,
  useMarket,
} from "@/lib/markets";
import { DISPUTE_FEE, DISPUTE_WINDOW_MS } from "@/lib/trading-rules";
import { useStore } from "@/lib/store";
import { useMarketNews } from "@/lib/admin";
import { ChartWatermark, StepChart } from "@/components/polka/StepChart";
import { TradePanel } from "@/components/polka/TradePanel";
import { Btn3D, Crest, Thumb } from "@/components/polka/ui";
import { Odometer } from "@/components/polka/Odometer";
import { Avatar } from "@/components/polka/AccountUI";
import { useConnectionStatus } from "@/lib/crypto";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { appendReply, fetchLiveComments, insertMarketComment, readMarketComments, saveMarketComments } from "@/lib/market-comments";
import { outcomeTone } from "@/lib/market-presentation";
import { MarketClosed } from "@/components/polka/MarketClosed";
import { mapDbMarket, upsertMarket } from "@/lib/markets";
import { Countdown, ResponsiveModal } from "@/components/polka/Countdown";

export const Route = createFileRoute("/market/$id")({
  loader: async ({ params }) => {
    let m = getMarket(params.id);
    if (!m) {
      const { data } = await supabase.from("markets").select("*").eq("id", params.id).maybeSingle();
      if (data) {
        const loaded = mapDbMarket(data);
        upsertMarket(loaded);
        m = loaded;
      }
    }
    if (!m) throw notFound();
    return { id: m.id, question: m.question, category: m.category, yes: Math.round((m.outcomes[0]?.prob ?? 0.5) * 100), lead: m.outcomes[0]?.label ?? "Yes" };
  },

   head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Market unavailable | Polka" },
          { name: "robots", content: "noindex" },
        ],
        links: [],
      };
    }

    const marketUrl = `https://polka.co.ke/market/${loaderData.id}`;
    const ogImageUrl = `https://polka.co.ke/api/og?id=${loaderData.id}&v=${loaderData.yes}`;

    return {
      meta: [
        { title: `${loaderData.question} | Polka` },
        {
          name: "description",
          content: `${loaderData.lead} at ${loaderData.yes}% on Polka. Trade this ${loaderData.category.toLowerCase()} market with instant M-Pesa deposits.`,
        },
        // Open Graph tags (Telegram, WhatsApp, Facebook, LinkedIn, Discord)
        { property: "og:site_name", content: "Polka" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: marketUrl },
        { property: "og:title", content: `${loaderData.question} | Polka` },
        {
          property: "og:description",
          content: `${loaderData.lead} ${loaderData.yes}% chance · ${loaderData.category} on Polka. Live odds, instant M-Pesa trades.`,
        },
        { property: "og:image", content: ogImageUrl },
        { property: "og:image:secure_url", content: ogImageUrl },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: `${loaderData.question} live odds card` },
        // Twitter / X card tags
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@polkake" },
        { name: "twitter:title", content: `${loaderData.question} | Polka` },
        {
          name: "twitter:description",
          content: `${loaderData.lead} ${loaderData.yes}% chance on Polka. Instant M-Pesa payouts.`,
        },
        { name: "twitter:image", content: ogImageUrl },
      ],
           links: [{ rel: "canonical", href: marketUrl }],
    };
  },
  component: MarketPage,
});
function CommentItem({ c, depth = 0, marketId, onReply }: { c: Comment; depth?: number; marketId: string; onReply: (parentId: string, reply: Comment) => void }) {
  const [open, setOpen] = useState(true);
  const { setPublicTrader, user, openAuth } = useStore();
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(false);
  const yes = c.stake && ["Yes", "Kenya", "Ruto", "Gor", "Arsenal"].includes(c.stake.side);
  return (
    <div className={cn(depth > 0 && "ml-4 border-l pl-4")}>
      <div className="py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Avatar handle={c.user} size="h-6 w-6" />
          <Btn3D
            onClick={() => setPublicTrader(c.user)}
            className="h-7 bg-transparent px-1 text-xs"
          >
            @{c.user}
          </Btn3D>
          {c.stake && (
            <span
              className={cn(
                "num rounded px-1.5 py-0.5 text-[11px] font-bold",
                yes ? "bg-up/15 text-up" : "bg-down/15 text-down",
              )}
            >
              [{c.stake.side.toUpperCase()} @{" "}
              {Math.round(
                (getMarket(marketId)?.outcomes.find((o) => o.label === c.stake?.side)?.prob ??
                  0.5) * 100,
              )}
              %]
            </span>
          )}
          <span className="text-xs text-muted-foreground">{c.ago}</span>
        </div>
        <p className="mt-1.5 pl-8 text-sm text-foreground/90">{c.text}</p>
        <div className="mt-1.5 flex gap-4 pl-8 text-xs text-muted-foreground">
          <button
            onClick={() => {
              if (!user) return openAuth();
              setLiked((v) => !v);
            }}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <ThumbsUp className="h-3.5 w-3.5" />{" "}
            <span className="num">{c.likes + (liked ? 1 : 0)}</span>
          </button>
          <button
            onClick={() => {
              if (!user) return openAuth();
              setReplying((v) => !v);
            }}
            className="hover:text-foreground"
          >
            Reply
          </button>
          {c.replies?.length ? (
            <button onClick={() => setOpen(!open)} className="hover:text-foreground">
              {open ? "Hide" : `Show ${c.replies.length}`} replies
            </button>
          ) : null}
        </div>
      </div>
      {replying && (
        <div className="ml-8 flex gap-2 pb-3">
          <input
            aria-label={`Reply to ${c.user}`}
            className="input-field min-w-0 text-sm"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
          />
          <Btn3D
            className="h-10 px-3 text-xs"
            disabled={!reply.trim()}
            onClick={() => {
              if (!user) return openAuth();
              onReply(c.id, {
                  id: crypto.randomUUID(),
                  user: user.handle,
                  text: reply.trim(),
                  ago: "now",
                  likes: 0,
              });
              setOpen(true);
              setReply("");
              setReplying(false);
            }}
          >
            Reply
          </Btn3D>
        </div>
      )}
      {open &&
        c.replies?.map((r) => (
          <CommentItem key={r.id} c={r} depth={depth + 1} marketId={marketId} onReply={onReply} />
        ))}
    </div>
  );
}

function useNowTick(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}

function ProposedBanner({ proposed, onDispute }: { proposed: Proposed; onDispute: () => void }) {
  const now = useNowTick();
  const left = Math.max(0, DISPUTE_WINDOW_MS - (now - proposed.at));
  const open = now - proposed.at < DISPUTE_WINDOW_MS;
  return (
    <div className="rounded-xl border border-chart-4/40 bg-chart-4/10 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Gavel className="h-4 w-4 shrink-0 text-chart-4" />
        <span>
          <b>Proposed outcome: {proposed.outcome}</b>
        </span>
        <span className="num ml-auto text-xs font-semibold text-chart-4">
          {open
            ? `Dispute window closes in ${Math.floor(left / 60000)}:${String(
                Math.floor((left % 60000) / 1000),
              ).padStart(2, "0")}`
            : "Dispute window closed"}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {proposed.evidenceUrl && (
          <a
            href={proposed.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs underline"
          >
            View evidence <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {open && (
          <Btn3D variant="surface" className="h-9 px-3 text-xs" onClick={onDispute}>
            <Gavel className="h-3.5 w-3.5" /> File a dispute (KES {DISPUTE_FEE})
          </Btn3D>
        )}
      </div>
    </div>
  );
}

function MarketPage() {
  const { id } = Route.useLoaderData();
  const m = useMarket(id)!;
  const adminNews = useMarketNews(id);
  const { slip, openSlip, positions, user, openAuth, balance, adjustBalance, setSlipDocked } =
    useStore();
  const [sel, setSel] = useState(m.outcomes[0]!.id);
  const [view, setView] = useState<string>("all");
  const [chartOpen, setChartOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [dispute, setDispute] = useState({ reason: "", proof: "" });
  const [draft, setDraft] = useState("");
    const [comments, setComments] = useState(m.comments);
  useEffect(() => {
    setComments(readMarketComments(m.id, m.comments));
    fetchLiveComments(m.id).then((live) => {
      if (live.length > 0) {
        setComments(live);
        saveMarketComments(m.id, live);
      }
    });
    setSel(m.outcomes[0]?.id ?? "");
    setView("all");
    setDraft("");
  }, [m.id]);

  const updateComments = (next: Comment[]) => {
    setComments(next);
    if (!saveMarketComments(m.id, next)) toast.error("Comments could not be saved on this device.");
  };
  // Dock the order ticket into the right rail on desktop — no floating dialog here.
  useEffect(() => {
    setSlipDocked(true);
    return () => setSlipDocked(false);
  }, [setSlipDocked]);
  const selected = slip?.marketId === m.id ? slip.outcomeId : sel;
  const o = m.outcomes.find((x) => x.id === selected)!;
  const idx = m.outcomes.indexOf(o);
  const binary = m.outcomes.length === 2;
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  const color = binary
    ? idx === 1
      ? "var(--down)"
      : "var(--up)"
    : (colors[idx % 4] ?? "var(--chart-1)");
  const state = m.state ?? "open";
  const settled = state === "settled";
  const winner = m.finalOutcome;
  const chartProb = settled ? (o.label === winner ? 1 : 0) : o.prob;
  // Binary markets derive both curves from one Yes series so No mirrors it exactly.
  const yesHistory = useMemo(
    () => {
      if (!binary) return [];
      if (m.eat) {
        const live = getLiveHistory(m.id);
        return live.length > 1 ? live : flatHistory(m.outcomes[0]!.prob);
      }
      return genHistory(hashId(m.id + m.outcomes[0]!.id), m.outcomes[0]!.prob);
    },
    [binary, m.id, m.outcomes, m.eat],
  );
  const data = useMemo(
    () =>
      settled || (m.flat && !m.eat)
        ? flatHistory(chartProb)
        : binary
          ? idx === 0
            ? yesHistory
            : mirrorHistory(yesHistory)
          : genHistory(hashId(m.id + o.id), chartProb),
    [m.id, o, m.flat, settled, chartProb, binary, idx, yesHistory],
  );
  const lines = useMemo(() => {
    if (settled || view !== "all") return [];
    if (binary) {
      const other = m.outcomes[1 - idx]!;
      return [
        {
          label: other.label,
          data: idx === 0 ? mirrorHistory(yesHistory) : yesHistory,
          color: idx === 0 ? "var(--down)" : "var(--up)",
        },
      ];
    }
    return m.outcomes
      .filter((x) => x.id !== o.id)
      .map((x) => ({
        label: x.label,
        data: genHistory(hashId(m.id + x.id), x.prob),
        color: colors[m.outcomes.indexOf(x) % 4] ?? "var(--chart-1)",
      }));
  }, [m.id, m.outcomes, o, idx, binary, view, settled, yesHistory]);
  const headRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const [navH, setNavH] = useState(57);
  useEffect(() => {
    const onScroll = () => {
      setDocked(window.scrollY > 240);
      // The global navbar is taller on phones (second row), so dock right beneath it.
      const h = document.querySelector("header")?.getBoundingClientRect().height;
      if (h) setNavH(Math.round(h));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const myStake = positions.filter((p) => p.marketId === m.id && p.status === "open");
  const { status: conn, retry: retryConn } = useConnectionStatus();
  const now = useNowTick(30_000);
  const shareMult = toMultiplier(o.prob);
  const shareUrl = referralLink(user?.handle, `/market/${m.id}`);
  const shareText = `${m.question} — ${o.label.toUpperCase()} pays ${shareMult.toFixed(2)}x · KES 1,000 returns ${fmtKES(1000 * shareMult, 2)}`;

  const pick = (oid: string) => {
    setSel(oid);
    setView(oid);
    if (state === "open") openSlip(m.id, oid);
  };

  const submitDispute = () => {
    if (!user) return openAuth();
    if (balance < DISPUTE_FEE) {
      toast.error(`Filing a dispute needs at least ${fmtKES(DISPUTE_FEE)} balance.`);
      return;
    }
    adjustBalance(-DISPUTE_FEE);
    toast.success("Dispute filed for review", {
      description: dispute.reason.trim().slice(0, 90),
    });
    setDisputeOpen(false);
    setDispute({ reason: "", proof: "" });
  };

  const lead = m.outcomes[0]!;
  return (
    <>
    <div
      aria-hidden={!docked}
      style={{ top: navH }}
      className={cn(
        "sticky top-[57px] z-30 -mb-[45px] border-b border-border/40 bg-background/90 px-4 py-2 backdrop-blur transition-all duration-300",
        docked ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full">
          <Thumb m={m} size={28} />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{m.question}</p>
        <span className="num hidden shrink-0 text-xs font-bold sm:inline">
          <span className={binary ? "text-up" : "text-foreground"}>
            {lead.label} {settled ? (lead.label === winner ? 100 : 0) : Math.round(lead.prob * 100)}%
          </span>
        </span>
        <span className="num shrink-0 text-xs font-bold sm:hidden">
          {settled ? (lead.label === winner ? 100 : 0) : Math.round(lead.prob * 100)}%
        </span>
        <a
          aria-label="Share on WhatsApp"
          title="Share on WhatsApp"
          tabIndex={docked ? 0 : -1}
          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-3d grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card [--bevel:color-mix(in_oklab,var(--border)_80%,black)]"
        >
          <WhatsAppIcon className="h-5 w-5" />
        </a>
        <button
          aria-label="Share market"
          title="Share market"
          tabIndex={docked ? 0 : -1}
          onClick={() => setShareOpen(true)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted"
        >
          <Share2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
    <div ref={headRef} className="mx-auto grid max-w-7xl gap-6 px-3 pt-4 md:px-6 md:pt-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Markets
        </Link>
        {state !== "open" && <MarketClosed m={m} />}
        {state === "proposed" && m.proposed && (
          <ProposedBanner proposed={m.proposed} onDispute={() => setDisputeOpen(true)} />
        )}
        {settled && (
          <div className="rounded-xl border border-up/40 bg-up/10 p-3 text-sm">
            <p>
              <b>Final result: {winner}</b> · Market settled.
            </p>
            {myStake.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-up/20 pt-2 text-xs">
                {myStake.map((p) =>
                  p.outcome === winner ? (
                    <p key={p.id} className="num text-up">
                      {p.outcome} · {fmtKES(p.stake)} @ {p.mult.toFixed(2)}x → pays{" "}
                      {fmtKES(p.stake * p.mult, 2)}
                    </p>
                  ) : (
                    <p key={p.id} className="num text-muted-foreground">
                      {p.outcome} · {fmtKES(p.stake)} → returns 0
                    </p>
                  ),
                )}
              </div>
            )}
          </div>
        )}
        {m.sport ? (
          <div>
            <div className="num flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {m.sport.liveMin !== undefined && state === "open" ? (
                <span className="font-bold text-up">● LIVE {m.sport.liveMin}&apos;</span>
              ) : (
                <Countdown closesAt={m.closesAt} label={m.endsLabel} />
              )}
              <span>·</span>
              <span className="text-foreground/80">KES {fmtCompact(m.volume)} Vol</span>
              <span>·</span>
              <span>{m.sport.league}</span>
            </div>
            <div className="mt-4 flex items-start justify-center gap-4 md:gap-10">
              <div className="flex w-28 flex-col items-center gap-2 text-center">
                <span className="grid place-items-center">
                  <Crest name={m.sport.home} src={m.sport.homeCrest} size={64} />
                </span>
                <span className="text-sm font-semibold leading-tight">{m.sport.home}</span>
              </div>
              <span className="mt-8 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold tracking-wide text-muted-foreground">
                VS
              </span>
              <div className="flex w-28 flex-col items-center gap-2 text-center">
                <span className="grid place-items-center">
                  <Crest name={m.sport.away} src={m.sport.awayCrest} size={64} />
                </span>
                <span className="text-sm font-semibold leading-tight">{m.sport.away}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Thumb m={m} size={52} />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight md:text-2xl">{m.question}</h1>
              <div className="num mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span className="text-foreground/80">KES {fmtCompact(m.volume)} Vol</span>
                <span>{m.category}</span>
                <span>Ends <Countdown closesAt={m.closesAt} label={m.endsLabel} /></span>
              </div>
            </div>
          </div>
        )}
        {m.eat && <EatTargetBar m={m} />}

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-baseline gap-3">
            <span style={{ color }}>
              <Odometer
                value={settled ? (o.label === winner ? 100 : 0) : o.prob * 100}
                format={(v) => `${Math.round(v)}%`}
                className="text-3xl font-bold"
              />
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="md:hidden">chance that </span>
              <span className="font-semibold text-foreground md:font-normal md:text-muted-foreground">{o.label}</span>
              <span className="md:hidden"> will win</span>
            </span>
            <button
              onClick={() => setChartOpen((v) => !v)}
              className="ml-auto rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground md:hidden"
              aria-expanded={chartOpen}
            >
              {chartOpen ? "Hide chart" : "View chart"}
            </button>
          </div>
          <div className="mb-1 h-2 overflow-hidden rounded-full bg-secondary md:hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(o.prob * 100)}%`, background: color }} />
          </div>
          <div className={cn(!chartOpen && "hidden md:block")}>
          <StepChart
            data={data}
            color={color}
            height={280}
            liveProb={state === "open" ? o.prob : undefined}
            status={conn}
            onRetry={retryConn}
            lines={lines}
            mainLabel={o.label}
            outcomes={m.outcomes.map((x) => ({ id: x.id, label: x.label }))}
            activeOutcome={view}
            onOutcome={(vid) => {
              setView(vid);
              if (vid !== "all") {
                setSel(vid);
                if (state === "open") openSlip(m.id, vid);
              }
            }}
          />
          </div>
          <Btn3D
            aria-label="Share market"
            title="Share market"
            className="mt-3 h-9 px-3 text-xs"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Btn3D>
        </section>
        {m.eat && <EatRounds sym={m.eat.sym} />}

        <section className="overflow-hidden rounded-xl border bg-card">
          {m.outcomes.map((x, i) => (
            <div
              key={x.id}
              className={cn(
                "flex items-center gap-3 border-b px-4 py-3 last:border-0",
                settled && x.label === winner ? cn("settled-winner", `outcome-${outcomeTone(m, i, true)}`) : x.id === selected && "bg-primary/5",
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">{settled && x.label === winner && <Gavel className="h-4 w-4 shrink-0" />}<span className="truncate">{x.label}</span></span>
              <span className="num w-14 text-right text-lg font-bold">
                {settled ? (x.label === winner ? 100 : 0) : Math.round(x.prob * 100)}%
              </span>
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: binary ? (i === 0 ? "var(--up)" : "var(--down)") : colors[i % colors.length] }}
              />
              {state === "open" ? <Btn3D
                variant={binary ? (i === 0 ? "up" : "down") : "surface"}
                onClick={() => pick(x.id)}
                className={cn("num h-10 w-28 text-sm", !binary && "text-foreground")}
                style={
                  binary
                    ? undefined
                    : {
                        background: `color-mix(in oklab, ${colors[i % colors.length]} ${x.id === selected ? 85 : 22}%, transparent)`,
                        ["--bevel" as string]: `color-mix(in oklab, ${colors[i % colors.length]} 60%, black)`,
                      }
                }
              >
                Buy {fmtOutcome(x.prob, "odds")}
              </Btn3D> : <span className="w-16 shrink-0 text-right text-xs font-semibold">{settled ? x.label === winner ? "Winner" : "Settled" : "Closed"}</span>}
            </div>
          ))}
        </section>

                {myStake.length > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Your positions</p>
              <Link to="/portfolio" className="text-xs font-bold text-primary hover:underline">
                View in Portfolio →
              </Link>
            </div>

            <div className="flex items-center justify-between gap-1 rounded-lg bg-background/50 p-2 text-[11px]">
              <span className="font-bold text-emerald-500">✓ Order Placed</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold text-primary">Active in Pool</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-muted-foreground">Payout upon Resolution</span>
            </div>

            {myStake.map((p) => (
              <div key={p.id} className="border-t border-border/40 pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="num text-muted-foreground">
                  <span className="font-bold text-foreground">{p.outcome}</span> · {fmtKES(p.stake)} @ {p.mult.toFixed(2)}x →{" "}
                  <span className="font-bold text-up">{fmtKES(p.stake * p.mult)}</span>
                  <span className="ml-2 text-[11px] block sm:inline">
                    resolves in {fmtResolveEta(positionResolveAt(p) - now)}
                  </span>
                </div>

                <Btn3D
                  variant="primary"
                  className="h-7 px-2.5 text-xs font-semibold self-start sm:self-center"
                  onClick={() => {
                    const outcome = m.outcomes.find((o) => o.label === p.outcome);
                    if (outcome) openSlip(m.id, outcome.id);
                  }}
                >
                  + Add to position
                </Btn3D>
              </div>
            ))}
          </div>
        )}

        <RulesNewsTabs rules={m.rules} oracle={m.oracle} news={[...adminNews, ...m.news]} status={m.state ?? "open"} />
        <section className="relative rounded-xl border bg-card p-4 pb-7">
          <ChartWatermark />
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" /> Discussion{" "}
            <span className="num text-muted-foreground">{comments.length}</span>
          </h3>
          <div className="mt-3 flex gap-2">
            <input
              aria-label="Comment"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share your take…"
              className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm outline-none focus:border-primary"
            />
                       <Btn3D
              variant="primary"
              className="h-10 px-4 text-sm"
              disabled={!draft.trim()}
              onClick={async () => {
                if (!user) return openAuth();
                const s = myStake[0];
                const text = draft.trim();
                setDraft("");
                const optim: Comment = {
                  id: crypto.randomUUID(),
                  user: user.handle,
                  text,
                  ago: "just now",
                  likes: 0,
                  stake: s ? { amount: s.stake, side: s.outcome } : undefined,
                };
                updateComments([optim, ...comments]);
                await insertMarketComment({
                  marketId: m.id,
                  userId: user.id,
                  userHandle: user.handle,
                  text,
                  stake: s ? { amount: s.stake, side: s.outcome } : undefined,
                });
              }}
            >
              Post
            </Btn3D>

          </div>
          <div className="mt-2 divide-y">
            {comments.map((c) => (
              <CommentItem key={c.id} c={c} marketId={m.id} onReply={(parentId, reply) => updateComments(appendReply(comments, parentId, reply))} />
            ))}
          </div>
        </section>

        <div className="lg:hidden">
          <RelatedMarkets m={m} />
        </div>
      </div>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>File a dispute</DialogTitle>
          <DialogDescription>
            Challenge the proposed outcome within the 60-minute window. Filing fee{" "}
            {fmtKES(DISPUTE_FEE)}.
          </DialogDescription>
          <textarea
            aria-label="Dispute reason"
            value={dispute.reason}
            onChange={(e) => setDispute((d) => ({ ...d, reason: e.target.value }))}
            placeholder="Why is the proposed outcome wrong?"
            className="input-field min-h-20 text-sm"
          />
          <input
            aria-label="Proof link"
            value={dispute.proof}
            onChange={(e) => setDispute((d) => ({ ...d, proof: e.target.value }))}
            placeholder="Proof link (https://…)"
            className="input-field text-sm"
          />
          <Btn3D
            variant="primary"
            className="h-11"
            disabled={!dispute.reason.trim() || !/^https?:\/\//.test(dispute.proof)}
            onClick={submitDispute}
          >
            Submit dispute · KES {DISPUTE_FEE}
          </Btn3D>
        </DialogContent>
      </Dialog>
      <ResponsiveModal open={shareOpen} onOpenChange={setShareOpen} title="Share this market" description={m.question}>
          <div className="flex items-center gap-3">
            <Thumb m={m} size={52} />
            <div>
              <p className="num text-2xl font-bold text-up">
                {Math.round(o.prob * 100)}% · {o.label}
              </p>
              <p className="num text-sm">
                {o.label.toUpperCase()} pays {shareMult.toFixed(2)}x · KES 1,000 returns{" "}
                {fmtKES(1000 * shareMult, 2)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                [
                  "WhatsApp",
                  whatsappAsset.url,
                  `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
                ],
                [
                  "X",
                  xAsset.url,
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
                ],
                [
                  "Telegram",
                  telegramAsset.url,
                  `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
                ],
              ] as const
            ).map(([label, logo, href]) => (
              <Btn3D
                key={label}
                className="h-12 flex-col gap-0 px-1 text-[11px]"
                onClick={() => window.open(href, "_blank")}
              >
                <img src={logo} alt="" className="h-5 w-5 rounded-full object-cover" />
                {label}
              </Btn3D>
            ))}
            <Btn3D
              className="h-12 flex-col gap-0 px-1 text-[11px]"
              onClick={() => {
                navigator.clipboard?.writeText(`${shareText} ${shareUrl}`);
                toast("Caption copied — paste it on TikTok");
              }}
            >
              <img src={tiktokAsset.url} alt="" className="h-5 w-5 rounded-full object-cover" />
              TikTok
            </Btn3D>
          </div>
          <p className="num truncate text-xs text-muted-foreground">{shareUrl}</p>
          <Btn3D
            variant="primary"
            className="h-11"
            onClick={() => {
              navigator.clipboard?.writeText(`${shareText} ${shareUrl}`);
              toast("Market link copied");
            }}
          >
            Copy share link
          </Btn3D>
          <Btn3D
            className="h-11"
            onClick={async () => {
              try {
                const { renderSocialCard } = await import("@/lib/social-card");
                const blob = await renderSocialCard(m);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `polka-${m.id}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                toast.success("Graphic saved — post it on WhatsApp Status or Stories");
              } catch {
                toast.error("Couldn't create the graphic on this device");
              }
            }}
          >
            Download share graphic
          </Btn3D>
      </ResponsiveModal>
      <aside className="hidden lg:block">
        <div className="sticky top-28 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            {state === "open" ? <TradePanel marketId={m.id} outcomeId={selected} /> : <MarketClosed m={m} />}
          </div>
          <RelatedMarkets m={m} />
        </div>
      </aside>
    </div>
    </>
  );
}

/** Polymarket-style related markets from the same category. */
function RelatedMarkets({ m }: { m: Market }) {
  useMarketsVersion();
  const rel = markets.filter((x) => x.id !== m.id && x.category === m.category).slice(0, 4);
  if (rel.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Related in {m.category}</h3>
      <div className="mt-2 divide-y">
        {rel.map((r) => {
          const top = [...r.outcomes].sort((a, b) => b.prob - a.prob)[0]!;
          return (
            <Link
              key={r.id}
              to="/market/$id"
              params={{ id: r.id }}
              className="flex items-center gap-3 py-2.5 hover:opacity-90"
            >
              <Thumb m={r} size={32} />
              <span className="line-clamp-2 min-w-0 flex-1 text-xs font-medium">{r.question}</span>
              <span className="shrink-0 text-right">
                <span className="num block text-sm font-bold text-up">
                  {Math.round(top.prob * 100)}%
                </span>
                <span className="block text-[10px] text-muted-foreground">{top.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
