import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, Percent, Timer, TrendingUp } from "lucide-react";
import { Btn3D, Thumb } from "@/components/polka/ui";
import { Avatar } from "@/components/polka/AccountUI";
import { useStore } from "@/lib/store";
import { markets } from "@/lib/markets";

export const Route = createFileRoute("/r/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} invited you to Polka` },
      { name: "description", content: "Join Polka with 24 hours of zero trading fees. Trade on sports, politics, crypto and more." },
      { property: "og:title", content: `@${params.handle} invited you to Polka` },
      { property: "og:description", content: "Claim 24 hours of 0% trading fees on Polka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralWelcome,
});

function ReferralWelcome() {
  const { handle } = Route.useParams();
  const { user, openAuth } = useStore();
  useEffect(() => {
    try {
      localStorage.setItem("polka-referrer", handle);
    } catch {
      /* storage unavailable */
    }
  }, [handle]);
  const trending = [...markets].filter((m) => m.state !== "settled").sort((a, b) => b.volume - a.volume).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <section className="rounded-2xl border bg-card p-6 text-center">
        <div className="mx-auto w-fit">
          <Avatar handle={handle} size="h-16 w-16" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">You've been invited by</p>
        <h1 className="text-2xl font-bold">@{handle}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Join Polka and trade on what happens next — football, politics, crypto and more.
        </p>
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
          <div className="rounded-xl border bg-up/10 p-4">
            <Timer className="h-5 w-5 text-up" />
            <p className="mt-2 font-bold">24 hours of 0% fees</p>
            <p className="text-xs text-muted-foreground">Every trade is fee-free for your first day.</p>
          </div>
          <div className="rounded-xl border bg-primary/10 p-4">
            <Percent className="h-5 w-5 text-primary" />
            <p className="mt-2 font-bold">Invite friends, earn 10%</p>
            <p className="text-xs text-muted-foreground">Get 10% of the trading fees from everyone you invite.</p>
          </div>
        </div>
        {user ? (
          <Link to="/" className="mt-6 inline-block">
            <Btn3D variant="primary" className="h-12 px-8">Start trading</Btn3D>
          </Link>
        ) : (
          <Btn3D variant="primary" className="mt-6 h-12 px-8" onClick={() => openAuth("signup")}>
            <Gift className="h-4 w-4" /> Claim 24h free trading
          </Btn3D>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Welcome offer · 18+ only · Trading involves risk.</p>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><TrendingUp className="h-4 w-4" /> Trending now</h2>
        <div className="space-y-2">
          {trending.map((m) => (
            <Link key={m.id} to="/market/$id" params={{ id: m.id }} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/50">
              <Thumb m={m} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.question}</span>
              <span className="num text-sm font-bold">{Math.round((m.outcomes[0]?.prob ?? 0) * 100)}%</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
