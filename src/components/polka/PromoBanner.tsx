import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { assets, fmtPrice, useLivePrice } from "@/lib/crypto";
import { cn } from "@/lib/utils";

const slides = [
  { kicker: "60 second markets", title: "Trade up or down in the next minute", cta: "Start trading", asset: "btc" },
  { kicker: "Fast rounds", title: "Make your call. Get paid fast", cta: "Try a round", asset: "btc" },
  { kicker: "Bitcoin", title: "Bitcoin up or down?", cta: "Trade BTC", asset: "btc" },
  { kicker: "Ethereum", title: "Ethereum up or down?", cta: "Trade ETH", asset: "eth" },
  { kicker: "Solana", title: "Solana up or down?", cta: "Trade SOL", asset: "sol" },
];

function LiveTick() {
  const a = assets[0]!;
  const { price } = useLivePrice(a);
  return <span className="num">{price ? `BTC $${fmtPrice(price, a.decimals)}` : "BTC live"}</span>;
}

/** Auto-sliding sportsbook-style promo for the 60s Flash markets. */
export function PromoBanner() {
  const [i, setI] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % slides.length), 4000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <section aria-label="60 second markets" className="px-3 md:px-0">
      <div className="relative overflow-hidden rounded-2xl border border-foreground/10" style={{ background: "var(--gradient-flash)" }}>
        <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
          {slides.map((s) => (
            <Link key={s.title} to="/flash" search={{ asset: s.asset }} className="flex w-full shrink-0 items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{s.kicker}</p>
                <p className="font-display mt-1 text-3xl uppercase leading-none md:text-4xl">{s.title}</p>
              </div>
              <span className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">{s.cta}</span>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 pb-3 text-xs text-muted-foreground">
          {mounted ? <LiveTick /> : <span>BTC live</span>}
          <div className="flex gap-1">
            {slides.map((s, k) => (
              <button key={s.title} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-5 bg-primary" : "w-1.5 bg-foreground/25")} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
