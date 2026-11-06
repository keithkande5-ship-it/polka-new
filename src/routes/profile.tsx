import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/polka/AccountUI";
import { Btn3D } from "@/components/polka/ui";
import { fmtKES } from "@/lib/markets";
export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Trader profile | Polka" },
      { name: "description", content: "Your trader identity and resolved predictions on Polka." },
      { property: "og:title", content: "Trader profile | Polka" },
      { property: "og:description", content: "Public trader identity and event trading activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});
function Profile() {
  const { user, openAuth, positions } = useStore();
  if (!user)
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-2xl font-bold">Trader profile</h1>
        <Btn3D variant="primary" className="mt-5 h-11 px-5" onClick={() => openAuth()}>
          Log in
        </Btn3D>
      </div>
    );
  const resolved = positions.filter((p) => p.status !== "open");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <div className="flex items-center gap-4">
        <Avatar handle={user.handle} preset={user.avatar} size="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold">{user.displayName}</h1>
          <p className="text-primary">@{user.handle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Joined {new Date(user.joined).toLocaleDateString("en-KE")}
          </p>
        </div>
        <Link to="/settings" className="text-sm text-primary">
          Edit
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{user.bio || "No bio yet."}</p>
      <div className="grid grid-cols-2 gap-5 border-y py-5">
        <div>
          <p className="text-xs text-muted-foreground">Total volume traded</p>
          <p className="num mt-1 text-xl font-bold">
            {fmtKES(positions.reduce((a, p) => a + p.stake, 0))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Win rate</p>
          <p className="num mt-1 text-xl font-bold">
            {resolved.length
              ? `${Math.round((resolved.filter((p) => p.status === "won").length / resolved.length) * 100)}%`
              : "—"}
          </p>
        </div>
      </div>
      <h2 className="font-semibold">Resolved predictions</h2>
      {resolved.length ? (
        resolved.map((p) => (
          <div key={p.id} className="border-b py-3">
            <p className="text-sm">{p.title}</p>
            <p className="num mt-1 text-xs text-muted-foreground">
              {p.outcome} · {p.status === "won" ? `Profit +KES ${Math.round(p.stake * p.mult - p.stake).toLocaleString()}` : p.status === "lost" ? `Loss -KES ${Math.round(p.stake).toLocaleString()}` : "Open"}
            </p>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No resolved predictions yet.</p>
      )}
    </div>
  );
}
