import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { opsTapSequence } from "@/lib/trading-rules";
import { ReportIssueDialog } from "./ReportIssue";
import { Btn3D, Logo } from "./ui";
import { useAdmin } from "@/lib/admin";
import { SITE_DOMAIN, SITE_URL } from "@/lib/site";
import { getMarket, markets, useCategories, useMarketsVersion } from "@/lib/markets";
export const disclaimer =
  "Polka is a peer-to-peer event trading and prediction market platform. Polka is not a bookmaker, does not accept bets, and is not licensed or regulated by the Betting Control and Licensing Board (BCLB). Trading event contracts involves capital risk. 18+ only.";
const community = [
  ["whatsapp", "WhatsApp Community"],
  ["telegram", "Telegram Channel"],
  ["x", "X"],
  ["support", "Support Desk"],
] as const;
export function Footer() {
  const navigate = useNavigate();
  const taps = useRef<number[]>([]);
  const { links, notice } = useAdmin();
  const [reportOpen, setReportOpen] = useState(false);
  const categories = useCategories();
  useMarketsVersion();
  const active = markets.map((m) => getMarket(m.id) ?? m).filter((m) => (m.state ?? "open") === "open");
  const activeCategories = categories.filter((c) => c !== "All" && active.some((m) => m.category === c));
  const trending = [...active].sort((a, b) => (b.hot?.change ?? 0) - (a.hot?.change ?? 0) || b.volume - a.volume).slice(0, 8);
  return (
    <footer className="mt-12 border-t px-5 pb-32 pt-8 md:pb-28">
      <div className="mx-auto max-w-7xl">
        <Btn3D aria-label="Polka footer logo" className="mb-6 bg-transparent shadow-none" onClick={() => {
          const next = opsTapSequence(taps.current, Date.now());
          taps.current = next.taps;
          if (next.unlocked) {
            taps.current = [];
            try { sessionStorage.setItem("polka-ops-unlocked", "1"); } catch { /* session storage unavailable */ }
            void navigate({ to: "/admin", search: { ops: undefined } });
          }
        }}>
          <Logo />
        </Btn3D>
        <div className="grid grid-cols-2 gap-6 text-xs md:grid-cols-4">
          <div className="space-y-3">
            <h3 className="font-bold">Markets</h3>
            <Link to="/" className="block text-muted-foreground">
              All markets
            </Link>
            <Link to="/flash" className="block text-muted-foreground">
              60s Flash
            </Link>
            <Link to="/search" className="block text-muted-foreground">
              Search
            </Link>
            {activeCategories.map((category) => <Link key={category} to="/" search={{ category }} className="block text-muted-foreground hover:text-foreground">{category}</Link>)}
          </div>
          <div className="space-y-3">
            <h3 className="font-bold">Rules &amp; Resolution</h3>
            <Link to="/rules" className="block text-muted-foreground">
              Event contract rules
            </Link>
            <p className="text-muted-foreground">Buy and hold until settlement</p>
          </div>
          <div className="space-y-3">
            <h3 className="font-bold">Terms &amp; Privacy</h3>
            <Link to="/terms" className="block text-muted-foreground">
              Terms of Service
            </Link>
            <Link to="/privacy" className="block text-muted-foreground">
              Privacy Policy
            </Link>
          </div>
          <div className="space-y-3">
            <h3 className="font-bold">Community</h3>
            {community.map(([k, label]) =>
              links[k] ? (
                <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-foreground">
                  {label}
                </a>
              ) : (
                <p key={k} className="text-muted-foreground">{label} · Not connected</p>
              ),
            )}
            <Btn3D type="button" onClick={() => setReportOpen(true)} className="h-auto justify-start bg-transparent text-left text-muted-foreground shadow-none hover:text-foreground">
              Report an issue
            </Btn3D>
          </div>
        </div>
        {trending.length > 0 && <nav aria-label="Trending market questions" className="mt-8 border-t pt-5">
          <h3 className="mb-3 text-xs font-bold">Trending markets</h3>
          <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">{trending.map((m) => <Link key={m.id} to="/market/$id" params={{ id: m.id }} className="text-xs leading-relaxed text-muted-foreground hover:text-foreground">{m.question}</Link>)}</div>
        </nav>}
        {notice && <p className="mt-8 max-w-5xl rounded-lg border bg-card p-3 text-xs">{notice}</p>}
        <p className="mt-8 max-w-5xl text-[11px] leading-relaxed text-muted-foreground">
          {disclaimer}
        </p>
        <p className="mt-4 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Polka · <a href={SITE_URL} className="font-semibold text-foreground">{SITE_DOMAIN}</a>
        </p>
      </div>
      <ReportIssueDialog open={reportOpen} onOpenChange={setReportOpen} />
    </footer>
  );
}
