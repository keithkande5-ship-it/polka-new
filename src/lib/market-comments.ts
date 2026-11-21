import { supabase } from "@/integrations/supabase/client";
import type { Comment } from "./markets";

export const marketCommentsKey = (id: string) => `polka-market-comments:${id}`;




function isComment(value: unknown): value is Comment {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<Comment>;
  return typeof c.id === "string" && typeof c.user === "string" &&
    typeof c.text === "string" && typeof c.ago === "string" && typeof c.likes === "number" &&
    (c.replies === undefined || (Array.isArray(c.replies) && c.replies.every(isComment)));
}

export function readMarketComments(id: string, fallback: Comment[]): Comment[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(marketCommentsKey(id)) ?? "null");
    return Array.isArray(saved) && saved.every(isComment) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchLiveComments(marketId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from("market_comments")
    .select("*")
    .eq("market_id", marketId)
    .order("created_at", { ascending: true });
  if (!data || data.length === 0) return [];
  return data.map((c) => ({
    id: c.id,
    user: c.user_handle,
    text: c.text,
    ago: new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    likes: c.likes ?? 0,
    replies: [],
  }));
}

export function saveMarketComments(id: string, comments: Comment[], currentUser?: { id: string; handle: string }): boolean {
  try {
    localStorage.setItem(marketCommentsKey(id), JSON.stringify(comments));
    const latest = comments[comments.length - 1];
    if (latest && currentUser) {
      void supabase.from("market_comments").insert({
        market_id: id,
        user_id: currentUser.id,
        user_handle: currentUser.handle,
        text: latest.text,
      });
    }
    return true;
  } catch {
    return false;
  }
}
export function appendReply(comments: Comment[], parentId: string, reply: Comment): Comment[] {
  return comments.map((c) => c.id === parentId
    ? { ...c, replies: [...(c.replies ?? []), reply] }
    : c.replies ? { ...c, replies: appendReply(c.replies, parentId, reply) } : c);
}
