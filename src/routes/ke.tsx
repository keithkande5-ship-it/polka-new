import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ke")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
