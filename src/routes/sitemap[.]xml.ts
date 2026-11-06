import { createFileRoute } from "@tanstack/react-router";
import { markets } from "@/lib/markets";

const BASE = "https://polka4.lovable.app";
const STATIC = ["/", "/flash", "/rules", "/terms", "/privacy", "/rewards"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const cats = [...new Set(markets.map((m) => m.category))];
        const urls = [
          ...STATIC,
          ...cats.map((c) => `/?category=${encodeURIComponent(c)}`),
          ...markets.filter((m) => (m.state ?? "open") !== "settled").map((m) => `/market/${m.id}`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${BASE}${u.replace(/&/g, "&amp;")}</loc></url>`)
          .join("\n")}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
