import { supabase } from "@/integrations/supabase/client";
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
    const [userClaim, setUserClaim] = useState<{ id: string; status: string; credited: boolean } | null>(null);
  const [loadingClaim, setLoadingClaim] = useState(true);

    useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    let active = true;
    async function loadClaim() {
      const { data } = await supabase
        .from("referral_commissions")
        .select("id, amount, source_trade_id")
        .eq("referrer_id", uid)
        .eq("source_trade_id", "bonus_claim_kes_500")
        .maybeSingle();

      if (active) {
        if (data) {
          // If amount is 0, pending admin review; if 500, approved and credited
          setUserClaim({
            id: data.id,
            status: data.amount > 0 ? "approved" : "pending",
            credited: data.amount > 0,
          });
        }
        setLoadingClaim(false);
      }
    }
    loadClaim();
    return () => { active = false; };
  }, [user?.id]);

  const link = referralLink(user?.handle);

  const ledger = useCommissions(user?.handle);
  const earned = ledger.reduce((a, c) => a + c.amount, 0);
  const friends = new Set(ledger.map((c) => c.friend)).size;
  const eligible = friends >= 5;
  const zeroLeft = zeroFeeRemainingMs(user, now);

  // When admin approves, credit wallet once and mark credited
  useEffect(() => {
    if (userClaim && userClaim.status === "approved" && !userClaim.credited) {
      adjustBalance(500);
      markClaimCredited(userClaim.id);
      toast.success("Admin approved! KES 500 referral bonus credited to your wallet.");
    }
  }, [userClaim, adjustBalance]);

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
    ["Friends trading", `${friends}/5`, "text-rewards"],
    ["Referral earnings", fmtKES(earned, 2), "text-up"],
    ["Bonus reward", fmtKES(500), "text-rewards"],
    [
      "Bonus status",
      userClaim
        ? userClaim.status === "approved"
          ? "Approved ✓"
          : userClaim.status === "rejected"
          ? "Rejected"
          : "Pending Admin"
        : eligible
        ? "Ready to Claim"
        : `${Math.max(0, 5 - friends)} more needed`,
      userClaim?.status === "approved" ? "text-up" : userClaim?.status === "pending" ? "text-chart-4" : "text-muted-foreground",
    ],
  ];

   const handleClaim = async () => {
    if (!user) return openAuth();
    if (friends < 5) {
      return toast.error("Invite at least 5 friends who trade to unlock this bonus.");
    }
    const { error } = await supabase.from("referral_commissions").insert({
      referrer_id: user.id,
      amount: 0, // 0 indicates pending admin approval
      source_trade_id: "bonus_claim_kes_500",
    });
    if (error) {
      toast.error("Could not submit claim: " + error.message);
      return;
    }
    setUserClaim({ id: crypto.randomUUID(), status: "pending", credited: false });
    toast.success("Claim submitted · Awaiting Admin review in Command Center");
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
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Claim KES 500 bonus</p>
          <span className="rounded-full bg-rewards/15 px-2.5 py-0.5 text-xs font-semibold text-rewards">
            {friends}/5 friends trading
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Invite 5 friends who make a trade to unlock the KES 500 bonus. Once submitted, your claim enters pending status and is credited as soon as an admin approves it in the Admin Command Center.
        </p>

        {userClaim?.status === "pending" ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-chart-4/10 p-3 text-sm text-chart-4">
            <Hourglass className="h-4 w-4 shrink-0" />
            <span>
              <b>Pending Admin Approval:</b> Your claim for KES 500 was submitted and is pending review by the admin team.
            </span>
          </div>
        ) : userClaim?.status === "approved" ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-up/10 p-3 text-sm text-up">
            <PartyPopper className="h-4 w-4 shrink-0" />
            <span>
              <b>Bonus Approved:</b> KES 500 has been approved and credited to your wallet balance.
            </span>
          </div>
        ) : userClaim?.status === "rejected" ? (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <span><b>Claim Rejected:</b> Trade verification did not pass. Invite active trading friends and try again.</span>
            {eligible && (
              <Btn3D className="h-8 px-3 text-xs bg-rewards text-white" onClick={handleClaim}>
                Re-apply
              </Btn3D>
            )}
          </div>
        ) : eligible ? (
          <Btn3D className="mt-3 h-11 w-full bg-rewards text-white [--bevel:color-mix(in_oklab,var(--rewards)_45%,black)]" onClick={handleClaim}>
            <PartyPopper className="h-4 w-4" /> Submit KES 500 Bonus Claim (5/5 trading friends unlocked)
          </Btn3D>
        ) : (
          <Btn3D disabled className="mt-3 h-11 w-full opacity-60 cursor-not-allowed">
            <Lock className="h-4 w-4 mr-2" /> Invite 5 friends who trade to unlock ({friends}/5)
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
