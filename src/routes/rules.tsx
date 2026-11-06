import { createFileRoute } from "@tanstack/react-router";
import { flashMultipliers, useRake } from "@/lib/trading-rules";
import { disclaimer } from "@/components/polka/Footer";
export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rules & Resolution | Polka" },
      { name: "description", content: "Rules & Resolution for Polka event contract trading." },
      { property: "og:title", content: "Rules & Resolution | Polka" },
      {
        property: "og:description",
        content: "Polka platform policies and trading risk information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const rakePct = Math.round(useRake() * 100);
  const evenMult = flashMultipliers(null, null).up;
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-5 py-10">
      <h1 className="text-3xl font-bold">Rules & Resolution</h1>
      <p className="text-xs text-muted-foreground">Draft · Updated 20 October 2026</p>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Event contracts</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Each market lists its resolution condition and oracle source. The specified official
          publication determines the final outcome.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Buy and hold</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Positions remain open until settlement. Early selling and opposing positions on the same
          market are unavailable.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">60-second rounds</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          A round compares its final observed price with the lock price. Trading closes in the
          final 15 seconds and quoted multipliers freeze at that lock, so payouts can never exceed
          the net distributable pool after the platform rake. Only one position per round is
          permitted. Flash multipliers start at {evenMult.toFixed(2)}x and incorporate the platform
          rake (currently {rakePct}%), set in the admin trading rules.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Feed availability</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Backup prices are indicative only. Flash trading pauses while the live feed is
          unavailable. Real-money settlement requires a trusted, durable price source.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Payouts</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Projected payout equals trade size multiplied by the quoted multiplier. An
          out-of-the-money outcome returns zero.
        </p>
      </section>
      <p className="border-t pt-6 text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>
    </article>
  );
}
