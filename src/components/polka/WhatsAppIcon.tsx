import { DEFAULT_WA_COMMUNITY, useAdmin } from "@/lib/admin";

/** Official WhatsApp glyph in brand green. */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path fill="#25D366" d="M16 2.7A13.2 13.2 0 0 0 4.6 22.6L2.7 29.3l6.9-1.8A13.2 13.2 0 1 0 16 2.7Z" />
      <path
        fill="#fff"
        d="M23.3 19.4c-.4-.2-2.3-1.1-2.6-1.2-.4-.1-.6-.2-.9.2l-1.2 1.5c-.2.3-.4.3-.8.1a10.7 10.7 0 0 1-5.3-4.6c-.4-.7.4-.6 1.1-2.1.1-.3 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.9-.6h-.7c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.3 2.7 4.2 6.6 5.9 2.5 1.1 3.5 1.2 4.7 1 .8-.1 2.3-.9 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.8-.5Z"
      />
    </svg>
  );
}

export function CommunityCard() {
  const { links } = useAdmin();
  return (
    <a
      href={links.whatsapp || DEFAULT_WA_COMMUNITY}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-up/30 bg-up/10 p-3 transition hover:bg-up/15"
    >
      <WhatsAppIcon className="h-9 w-9 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Join our community</span>
        <span className="block text-xs text-muted-foreground">Polka Trading Community · Get instant market alerts</span>
      </span>
    </a>
  );
}
