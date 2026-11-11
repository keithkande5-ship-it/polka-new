import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, TrendingUp } from "lucide-react";
import { markets, useCategories } from "@/lib/markets";
import { MarketRow } from "@/components/polka/MarketRow";
import { FlashWidget } from "@/components/polka/FlashWidget";
import { Spotlight } from "@/components/polka/Spotlight";
import { Tutorial } from "@/components/polka/Tutorial";
import { cn } from "@/lib/utils";
import { BackToTop } from "@/components/polka/BackToTop";
import { rankScore } from "@/lib/market-presentation";
import { PromoBanner } from "@/components/polka/PromoBanner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => typeof search["category"] === "string" ? { category: search["category"] } : {},
  head: () => ({
    meta: [
      { title: "Polka — Kenya's Largest Prediction Market | Bet on Politics, Football & Current Events" },
      {
        name: "description",
        content:
          "Kenya's largest prediction market. Bet on elections, politics, football and current events with instant M-Pesa deposits.",
      },
      { property: "og:title", content: "Polka — Kenya's Largest Prediction Market | Bet on Politics, Football & Current Events" },
      {
        property: "og:description",
        content: "Kenya's largest prediction market. Bet on elections, politics, football and current events with instant M-Pesa deposits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "keywords", content: "Kenya prediction market, bet on elections Kenya, Kenya politics betting, football predictions Kenya, M-Pesa betting, Polka" },
      { property: "og:url", content: "https://polka.co.ke/" },
    ],
    links: [{ rel: "canonical", href: "https://polka.co.ke/" }],
  }),
  component: Home,
});

function HotTopics() {
  const hot = markets.filter((m) => m.hot).sort((a, b) => (b.hot?.change ?? 0) - (a.hot?.change ?? 0));
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
        <Flame className="h-4 w-4 text-primary" /> Hot Topics in Kenya
      </div>
      {hot.map((m, i) => (
        <Link
          key={m.id}
          to="/market/$id"
          params={{ id: m.id }}
          className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-muted/40"
        >
          <span className="num w-4 text-sm font-bold text-muted-foreground">{i + 1}</span>
          <p className="line-clamp-1 flex-1 text-sm">{m.question}</p>
          <span className="num flex shrink-0 items-center gap-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary">
            {i < 3 && <Flame className="h-3 w-3" />}+{m.hot?.change}%
          </span>
        </Link>
      ))}
    </div>
  );
}

function Home() {
  const cats = useCategories();
  const { category } = Route.useSearch();
  const [cat, setCat] = useState<string>(category ?? "All");
  useEffect(() => { setCat(category ?? "All"); }, [category]);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const isOpen = (m: (typeof markets)[number]) => (m.state ?? "open") === "open";
  const resolved = markets.filter((m) => !isOpen(m));
  const list = cat === "Resolved" ? resolved : (cat === "All" ? markets : markets.filter((m) => m.category === cat)).filter(isOpen);
  return (
    <div className="mx-auto grid max-w-7xl gap-6 md:px-6 md:pt-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <h1 className="px-4 pt-4 text-xl font-bold tracking-tight md:px-0 md:pt-0 md:text-2xl">
          {cat === "All" ? "Prediction markets on Kenya's biggest questions" : `${cat} prediction markets`}
        </h1>
        <Tutorial variant="home" />
        <Spotlight />
        <PromoBanner />
        <section className="border-y bg-card md:rounded-lg md:border">
          <div aria-label="Market categories" className="no-scrollbar sticky top-14 z-30 flex gap-1.5 overflow-x-auto border-b bg-background/90 px-3 py-2.5 backdrop-blur-md md:px-4">
            {[...cats, "Resolved"].map((c) => (
              <Link
                key={c}
                to="/"
                search={c === "All" ? {} : { category: c }}
                resetScroll={false}
                aria-current={cat === c ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-sm font-medium",
                  cat === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "Resolved" ? "Resolved ⚖" : c}
              </Link>
            ))}
            <span className="ml-auto hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
              <TrendingUp className="h-3.5 w-3.5" /> Trending for you
            </span>
          </div>
          {!ready ? Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3 border-b p-4">
              <div className="flex gap-3"><Skeleton className="h-10 w-10" /><Skeleton className="h-5 flex-1" /></div>
              <div className="grid grid-cols-2 gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            </div>
          )) : list.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No markets here yet.</p>
          ) : (() => {
            const now = Date.now();
            const volOrder = [...markets].sort((a, b) => b.volume - a.volume).map((m) => m.id);
            return [...list]
              .sort((a, b) => (Number((b as any).createdAt ? new Date((b as any).createdAt) : 0) - Number((a as any).createdAt ? new Date((a as any).createdAt) : 0)) || rankScore(b, now) - rankScore(a, now))
              .map((m) => <MarketRow key={m.id} m={m} volRank={volOrder.indexOf(m.id)} />);
          })()}
        </section>
      </div>
      <aside className="hidden space-y-4 lg:block">
        <div className="sticky top-20 space-y-4">
          <HotTopics />
          <FlashWidget />
        </div>
      </aside>
      <BackToTop />
    </div>
  );
}
