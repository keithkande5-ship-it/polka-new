import { createFileRoute, redirect } from "@tanstack/react-router";

/** Concealed operator alias; the console itself is cloaked behind a 404 for outsiders. */
export const Route = createFileRoute("/ops")({
  head: () => ({ meta: [{ title: "Operator access | Polka" }, { name: "description", content: "Polka operator access." }, { property: "og:title", content: "Operator access | Polka" }, { property: "og:description", content: "Polka operator access." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { ops: "1" } });
  },
});
