import { createFileRoute } from "@tanstack/react-router";
import { disclaimer } from "@/components/polka/Footer";
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Polka" },
      { name: "description", content: "Privacy Policy for Polka event contract trading." },
      { property: "og:title", content: "Privacy Policy | Polka" },
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
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-5 py-10">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground">Updated 4 November 2026</p>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Data we collect</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          We collect your display name, email, verified M-Pesa number, trade history, comments and
          device information needed to operate your account, prevent fraud and meet our obligations
          under the Data Protection Act, 2019. We process this data on the basis of contract and
          legal obligation, and we never sell it.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Preferences</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Theme and price-display preferences are saved in browser storage. You can clear them
          through your browser settings.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">External services</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Live crypto prices connect to Binance. Fonts may be loaded from Google Fonts. Opening news
          or share links takes you to external services with their own policies.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Payment credentials</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Polka never asks for or stores your M-Pesa PIN. Payments are confirmed on your phone
          through the Safaricom prompt and processed by our licensed payment partner, PalPluss.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Retention and your rights</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Transaction records are kept for seven years as required by financial record-keeping rules;
          other data is deleted when no longer needed. You may request access, correction or deletion
          of your data, or complain to the Office of the Data Protection Commissioner (ODPC).
        </p>
      </section>
      <p className="border-t pt-6 text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>
    </article>
  );
}
