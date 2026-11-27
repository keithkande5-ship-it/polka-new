import { useEffect, useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Flame, TrendingUp, Clock, HelpCircle, ShieldAlert } from "lucide-react";
import { markets, useCategories, useMarketsVersion, type Market } from "@/lib/markets";
import { MarketCard } from "@/components/polka/MarketCard";
import { cn } from "@/lib/utils";
import { Tutorial } from "@/components/polka/Tutorial";
import { BackToTop } from "@/components/polka/BackToTop";

const TRENDING_TAGS = ["#KPLDerby", "#RutoApproval", "#USDKES", "#EPL", "#BTC"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) =>
    typeof search["category"] === "string" ? { category: search["category"] } : {},
  head: () => ({
    meta: [
      { title: "Polka — Kenya's Largest Prediction Market | Bet on Politics, Football & Current Events" },
      {
        name: "description",
        content:
          "Kenya's largest prediction market. Bet on elections, politics, football and current events with instant M-Pesa deposits.",
      },
      { property: "og:title", content: "Polka — Kenya's Largest Prediction Market" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://polka.co.ke/" },
    ],
  }),
  component: Home,
});

type StatusTab = "active" | "closed" | "disputed" | "resolved";
type SortOption = "trending" | "new" | "closing";

function Home() {
  const cats = useCategories();
  const { category } = Route.useSearch();
  const [cat, setCat] = useState<string>(category ?? "All");
  const [status, setStatus] = useState<StatusTab>("active");
  const [sort, setSort] = useState<SortOption>("trending");
  const [showTutorial, setShowTutorial] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const marketVersion = useMarketsVersion();
  const [initialLoading, setInitialLoading] = useState(markets.length === 0);

  useEffect(() => {
    if (markets.length > 0) {
      const t = setTimeout(() => setInitialLoading(false), 150);
      return () => clearTimeout(t);
    }
  }, [marketVersion]);

  useEffect(() => {
    setCat(category ?? "All");
  }, [category]);

  const allCategories = useMemo(() => ["All", "🔴 Live", ...cats.filter((c) => c !== "All")], [cats]);

  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      // 1. Category Filter
      if (cat === "🔴 Live") {
        if (!m.sport?.liveMin && !m.eat) return false;
      } else if (cat !== "All") {
        if (m.category !== cat) return false;
      }

      // 2. Status Filter
      const isSettled = m.state === "settled" || m.state === "resolved";
      const isDisputed = m.state === "disputed";
      const isClosed = !isSettled && !isDisputed && ((m.state === "closed") || (Boolean(m.closesAt) && m.closesAt <= Date.now()));

      if (status === "active") {
        if (isClosed || isDisputed || isSettled) return false;
      } else if (status === "closed") {
        if (!isClosed) return false;
      } else if (status === "disputed") {
        if (!isDisputed) return false;
      } else if (status === "resolved") {
        if (!isSettled) return false;
      }
      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().replace(/^#/, "");
        const match =
          m.question.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.outcomes.some((o) => o.label.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sort === "trending") return b.volume - a.volume;
      if (sort === "closing") return a.closesAt - b.closesAt;
      return b.id.localeCompare(a.id); // Newest
    });
  }, [cat, status, sort, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      {/* 1. Category Navigation Ribbon (ABOVE Search) */}
      <div className="sticky top-14 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition-all",
                  cat === c
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        {/* 2. Search & Discovery Bar (BELOW Categories) */}
        <div className="space-y-2">
          <div className="relative flex items-center rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm focus-within:border-primary">
            <Search className="h-4 w-4 text-muted-foreground mr-2.5 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search markets, politics, sports, crypto…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Trending Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-semibold text-foreground mr-1">
              <Flame className="h-3.5 w-3.5 text-primary" /> Trending:
            </span>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag.replace("#", ""))}
                className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground hover:bg-primary/20 hover:text-primary transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Markets Controller (Status Tabs + Sort Controls) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          {/* Status Tabs */}
          <div className="flex gap-1 bg-secondary p-1 rounded-xl text-xs font-semibold self-start">
            {(["active", "closed", "disputed", "resolved"] as StatusTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatus(tab)}
                className={cn(
                  "capitalize rounded-lg px-3 py-1.5 transition-all",
                  status === tab
                    ? "bg-card text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1 text-xs self-end sm:self-center">
            <span className="text-muted-foreground mr-1">Sort by:</span>
            {(["trending", "new", "closing"] as SortOption[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "capitalize rounded-md px-2 py-1 transition-colors",
                  sort === s
                    ? "bg-primary/15 text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

              {/* 4. Responsive Market Cards Grid */}
        {initialLoading && markets.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4 lg:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-4 min-h-[160px] overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-20 rounded-md bg-muted animate-pulse" />
                    <div className="h-4 w-12 rounded-full bg-muted/70 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-muted animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="h-10 rounded-xl bg-muted/80 animate-pulse" />
                  <div className="h-10 rounded-xl bg-muted/80 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">No {status} markets found</p>
            <p className="text-xs text-muted-foreground">
              Try switching category or clearing your search filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4 lg:gap-4">
            {filteredMarkets.map((m) => (
              <MarketCard key={m.id} m={m} />
            ))}
          </div>
        )}


        {/* 5. Educational / How It Works Link Banner */}
                 <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <button
              onClick={() => setShowTutorial(true)}
              className="hover:text-foreground transition-colors underline cursor-pointer"
            >
              How Polka Works
            </button>
            <span>·</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms & Rules
            </Link>
          </div>
