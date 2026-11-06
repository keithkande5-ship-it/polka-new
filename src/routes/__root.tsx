import { EatDriver } from "@/components/polka/EatPanels";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "../lib/store";
import { Header, BottomNav } from "../components/polka/Header";
import { WhatsAppSlideup } from "../components/polka/WhatsAppSlideup";
import { StatusBanner } from "../components/polka/StatusBanner";
import { TradeSheet, ProfileDrawer, Cashier, Onboarding } from "../components/polka/Overlays";
import { AuthDock, AuthDrawer, PublicTraderModal } from "../components/polka/AccountUI";
import { Footer } from "../components/polka/Footer";
import { NotFoundView } from "../components/polka/NotFound";
import { Toaster } from "../components/ui/sonner";
import { track } from "../lib/analytics";

function NotFoundComponent() {
  return <NotFoundView />;
}

/** Records page views locally for the operator console's traffic workspace. */
function PageViewTracker() {
  const router = useRouter();
  useEffect(() => {
    if (!window.location.pathname.startsWith("/admin")) track("view", window.location.pathname);
    return router.subscribe("onResolved", ({ toLocation }) => {
      if (!toLocation.pathname.startsWith("/admin")) track("view", toLocation.pathname);
    });
  }, [router]);
  return null;
}


function OpsShortcut() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        try {
          sessionStorage.setItem("polka-ops-unlocked", "1");
        } catch {
          /* storage unavailable */
        }
        void router.navigate({ to: "/admin", search: { ops: undefined } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Polka — Kenya's prediction market" },
      {
        name: "description",
        content:
          "Trade on politics, football, the shilling and crypto with instant M-Pesa deposits.",
      },
      { name: "theme-color", content: "#0B0E14" },
      { name: "geo.region", content: "KE" },
      { name: "geo.placename", content: "Nairobi" },
      { name: "content-language", content: "en-KE" },
      { name: "keywords", content: "prediction market Kenya, trade with M-Pesa, Kenya election odds 2027, FKF predictions, Mashemeji Derby odds, KES dollar forecast, CBK rate predictions, Kenya crypto, 5050 markets alternative" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&display=swap",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon-light.png",
        media: "(prefers-color-scheme: light)",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const operator = useRouterState({ select: s => s.location.pathname === "/admin" || s.location.pathname === "/ops" });

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <StoreProvider>
        <StatusBanner />
        {!operator && <Header />}
        <main className={operator ? "" : "pb-20 md:pb-10"}>
          <Outlet />
          <EatDriver />
          {!operator && <Footer />}
        </main>
        {!operator && <BottomNav />}
        <TradeSheet />
        <ProfileDrawer />
        <Cashier />
        <Onboarding />
        <AuthDock />
        <AuthDrawer />
        <PublicTraderModal />
        <OpsShortcut />
        {!operator && <WhatsAppSlideup />}
        <PageViewTracker />
        <Toaster position="top-center" />
      </StoreProvider>
    </QueryClientProvider>
  );
}
