import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Gift, Lock, Hourglass, PartyPopper, Users } from "lucide-react";
import { toast } from "sonner";
import { fmtAxisKES, fmtDateTime, fmtKES, fmtResolveEta, niceDomain, useNowTick } from "@/lib/markets";
import { useStore } from "@/lib/store";
import { referralLink } from "@/lib/site";
import { zeroFeeRemainingMs } from "@/lib/trading-rules";
import {
  getUserBonusClaim,
  markClaimCredited,
  maskHandle,
  submitBonusClaim,
  useBonusClaims,
  useCommissions,
} from "@/lib/referrals";

import { StepChart } from "@/components/polka/StepChart";
import { Btn3D } from "@/components/polka/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Referrals and bonuses | Polka" },
      {
        name: "description",
        content: "Earn on Polka: invite friends for 10% referral commission and claim bonuses.",
      },
      { property: "og:title", content: "Rewards | Polka" },
      { property: "og:description", content: "Referral commission and bonuses on Polka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rewards,
});

/** Claims clear a 24-hour verification hold before funds are released. */
const HOLD_MS = 24 * 60 * 60 * 1000;

function Rewards() {
  const { user, openAuth, balance, adjustBalance } = useStore();
  const now = useNowTick(30_000);
  const [claimAt, setClaimAt] = useState<number | null>(null);
  const storageKey = rewardsStorageKey(user?.id);
  useEffect(() => {
    // Re-read whenever the account changes so claim timers never leak across users.
    const v = localStorage.getItem(storageKey);
    let at: number | null = null;
    try {
      const parsed = v ? (JSON.parse(v) as { claimAt?: number | null }) : null;
      at = typeof parsed?.claimAt === "number" ? parsed.claimAt : null;
    } catch {
      at = null;
    }
    setClaimAt(at);
  }, [storageKey]);
  const saveClaim = (at: number | null) => {
    setClaimAt(at);
    if (at === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify({ claimAt: at }));
  };
  const holding = claimAt !== null && now - claimAt < HOLD_MS;
  const readyToRelease = claimAt !== null && !holding;
  const link = referralLink(user?.handle);

  const ledger = useCommissions(user?.handle);
  const earned = ledger.reduce((a, c) => a + c.amount, 0);
  const friends = new Set(ledger.map((c) => c.friend)).size;
  const zeroLeft = zeroFeeRemainingMs(user, now);

  // Cumulative earnings over time: starts at zero at sign-up and runs to now.
  const earnings = useMemo(() => {
    const start = user?.joinedAt ?? now - 60 * 60 * 1000;
    const pts = [{ t: Math.min(start, ledger.at(-1)?.at ?? start), p: 0 }];
    let sum = 0;
    for (const c of [...ledger].reverse()) {
      sum += c.amount;
      pts.push({ t: c.at, p: Math.round(sum * 100) / 100 });
    }
    pts.push({ t: Math.max(now, pts.at(-1)!.t + 1), p: Math.round(sum * 100) / 100 });
    return pts;
  }, [ledger, user?.joinedAt, now]);

  const stats: [string, string, string][] = [
    ["Friends trading", String(friends), "text-rewards"],
    ["Referral earnings", fmtKES(earned, 2), "text-up"],
    ["Claimable bonus", fmtKES(500), "text-rewards"],
    [
      "Pending verification",
      holding ? fmtResolveEta((claimAt ?? 0) + HOLD_MS - now) : "—",
      "text-chart-4",
    ],
  ];

  const startClaim = () => {
    if (!user) return openAuth();
    const t = Date.now();
    saveClaim(t);
    toast("Claim submitted · 24-hour verification hold started");
  };

  const release = () => {
    adjustBalance(500);
    saveClaim(null);
    toast.success(fmtKES(500) + " bonus credited to your wallet");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 pt-4 md:px-6 md:pt-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-rewards/15 text-rewards">
          <Gift className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Rewards</h1>
          <p className="text-xs text-muted-foreground">
            Track referral earnings, streaks and bonus claims.
          </p>
        </div>
      </div>

      {!user ? (
        <section className="rounded-xl border border-rewards/30 bg-rewards/5 p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rewards/15 text-rewards">
            <Lock className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-lg font-bold">Your rewards are locked</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Sign in to view your referral earnings, copy your invite link, and withdraw rewards.
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            Earn 10% commission on friends' settled volume and claim bonuses after a 24-hour verification hold.
          </p>
          <Btn3D variant="primary" className="mx-auto mt-4 h-11 px-6" onClick={() => openAuth()}>
            Log In / Sign Up
          </Btn3D>
        </section>
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([l, v, c]) => (
          <div key={l} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className={cn("num mt-1 break-words text-base font-bold", c)}>{v}</p>
          </div>
        ))}
      </div>

      {zeroLeft > 0 && (
        <section className="rounded-xl border border-up/30 bg-up/5 p-3 text-sm">
          <span className="font-semibold text-up">0% trading fees active</span>
          <span className="num text-muted-foreground"> · {fmtResolveEta(zeroLeft)} left on your welcome window</span>
        </section>
      )}

      <section className="rounded-xl border border-rewards/30 bg-rewards/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-rewards">
          <Users className="h-4 w-4" /> Earnings growth
        </p>
        <p className="num mt-1 text-2xl font-bold text-up">{fmtKES(earned, 2)}</p>
        <StepChart
          data={earnings}
          valueFormat={fmtAxisKES}
          domain={niceDomain([...earnings.map((p) => p.p), 100])}
          color="var(--rewards)"
        />
      </section>

      <section className="rounded-xl border bg-card">
        <p className="border-b px-4 py-3 text-sm font-semibold">Commission payments</p>
        {ledger.length ? (
          <div className="divide-y">
            {ledger.slice(0, 50).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{maskHandle(c.friend)} · {c.market}</p>
                  <p className="num text-muted-foreground">
                    {fmtDateTime(c.at)} · traded {fmtKES(c.stake)} · fee {fmtKES(c.fee, 2)}
                  </p>
                </div>
                <span className="num font-bold text-up">+{fmtKES(c.amount, 2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No commissions yet. Share your link — you earn 10% of every fee your friends pay (fees are waived during their first 24 hours).
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">Claim bonus</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Claims pass a 24-hour verification hold before release. Bonuses are credited once verification completes.
        </p>
        {holding ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-chart-4/10 p-3 text-sm">
            <Hourglass className="h-4 w-4 text-chart-4" />
            <span className="num">
              Verifying · funds release in {fmtResolveEta((claimAt ?? 0) + HOLD_MS - now)}
            </span>
          </div>
        ) : readyToRelease ? (
          <Btn3D variant="primary" className="mt-3 h-11 w-full" onClick={release}>
            <PartyPopper className="h-4 w-4" /> Verification complete · release {fmtKES(500)}
          </Btn3D>
        ) : (
          <Btn3D className="mt-3 h-11 w-full bg-rewards text-white [--bevel:color-mix(in_oklab,var(--rewards)_45%,black)]" onClick={startClaim}>
            Claim {fmtKES(500)} bonus
          </Btn3D>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">Your referral link</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Friends join with your link — you earn 10% commission on their settled volume.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="num min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">
            {link}
          </span>
          <Btn3D
            aria-label="Copy referral link"
            title="Copy referral link"
            className="h-10 w-10"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              toast("Referral link copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Btn3D>
        </div>
        <p className="num mt-2 text-xs text-muted-foreground">Wallet balance {fmtKES(balance, 2)}</p>
      </section>
      </>
      )}
    </div>
  );
}
