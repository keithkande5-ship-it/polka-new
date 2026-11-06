export function CoinIcon({ symbol }: { symbol: string }) {
  const paths: Record<string, string> = {
    BTC: "M13 4v3m-3-3v3m3 10v3m-3-3v3M7 7h7a3 3 0 0 1 0 6H8m0-6v10h7a2 2 0 0 0 0-4",
    ETH: "M12 2 5 12l7 4 7-4-7-10ZM5 14l7 8 7-8-7 4-7-4Z",
    SOL: "M6 5h14l-3 3H3l3-3Zm-3 6h14l3 3H6l-3-3Zm3 6h14l-3 3H3l3-3Z",
    BNB: "m12 3 4 4-4 4-4-4 4-4Zm-7 7 3 3-3 3-3-3 3-3Zm14 0 3 3-3 3-3-3 3-3Zm-7 5 4 4-4 4-4-4 4-4Z",
    XRP: "M4 5l5 5a4 4 0 0 0 6 0l5-5M4 19l5-5a4 4 0 0 1 6 0l5 5",
  };
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
      <svg
        role="img"
        aria-label={symbol}
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={paths[symbol] ?? "M12 3v18M5 7h10a4 4 0 0 1 0 8H5"} />
      </svg>
    </span>
  );
}
