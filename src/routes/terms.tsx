import { createFileRoute } from "@tanstack/react-router";
import { disclaimer } from "@/components/polka/Footer";
export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | Polka" },
      { name: "description", content: "Terms of Service for Polka event contract trading." },
      { property: "og:title", content: "Terms of Service | Polka" },
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
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-xs text-muted-foreground">Updated 1 November 2026</p>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Compliance</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Polka takes compliance seriously and operates in line with the laws of Kenya, including the Capital Markets Act (Cap. 485A), the National Payment System Act and the Data Protection Act, 2019. Markets resolve against official sources such as IEBC, the Central Bank of Kenya, EPRA, FKF and the Kenya Gazette.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Platform status</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Polka operates a peer-to-peer event contract trading protocol. Traders take positions against
          each other on the outcome of public events; Polka does not take the other side of your trade
          and earns only the disclosed fees.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Eligibility</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          You must be at least 18 years old and confirm acceptance of these terms and the Privacy
          Policy before continuing.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Trading and capital risk</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Event contracts may close out of the money. Returns are estimates, not guarantees.
          Buy-and-hold positions settle according to each market’s published resolution rules; no
          early selling or opposing outcomes is offered.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Fees</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Deposit processing is KES 3 PalPluss plus KES 2 Polka, added to the deposit amount.
          Withdrawals deduct the applicable PalPluss tier plus KES 5 Polka handling. Review the
          itemized quote before continuing.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Disputes and governing law</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Resolution disputes may be filed within the published dispute window. These terms are
          governed by the laws of Kenya, and disputes not settled through our support desk fall under
          the jurisdiction of the courts of Kenya.
        </p>
      </section>
      <p className="border-t pt-6 text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>
    </article>
  );
}
