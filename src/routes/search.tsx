import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { markets } from "@/lib/markets";
import { MarketRow } from "@/components/polka/MarketRow";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search markets | Polka" },
      {
        name: "description",
        content: "Find prediction markets on Kenyan politics, sports, the economy and crypto.",
      },
      { property: "og:title", content: "Search markets | Polka" },
      { property: "og:description", content: "Find a market to trade on Polka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const list = markets.filter((m) =>
    (m.question + m.category + m.outcomes.map((o) => o.label).join(" "))
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-3xl md:px-6 md:pt-6">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-3 md:rounded-t-xl md:border">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Ruto, Gor Mahia, CBK, BTC…"
          className="flex-1 bg-transparent outline-none"
        />
      </div>
      <div className="bg-card md:rounded-b-xl md:border md:border-t-0">
        {list.map((m) => (
          <MarketRow key={m.id} m={m} />
        ))}
        {list.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No markets match “{q}”.</p>
        )}
      </div>
    </div>
  );
}
