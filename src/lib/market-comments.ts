import { supabase } from "@/integrations/supabase/client";
import type { Comment } from "./markets";

export const marketCommentsKey = (id: string) => `polka-market-comments:${id}`;

function isComment(value: unknown): value is Comment {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<Comment>;
  return (
    typeof c.id === "string" &&
    typeof c.user === "string" &&
    typeof c.text === "string" &&
    typeof c.ago === "string" &&
    typeof c.likes === "number" &&
    (c.replies === undefined || (Array.isArray(c.replies) && c.replies.every(isComment)))
  );
}

export function readMarketComments(id: string, fallback: Comment[]): Comment[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(marketCommentsKey(id)) ?? "null");
    return Array.isArray(saved) && saved.every(isComment) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function saveMarketComments(id: string, comments: Comment[]): boolean {
  try {
    localStorage.setItem(marketCommentsKey(id), JSON.stringify(comments));
    return true;
  } catch {
    return false;
  }
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function fetchLiveComments(marketId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from("market_comments")
      .select("*")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) return [];

    const topLevel: Comment[] = [];
    const replyMap = new Map<string, Comment[]>();

    for (const row of data) {
      const c: Comment = {
        id: row.id,
        user: row.user_handle,
        text: row.text,
        ago: timeAgo(row.created_at),
        likes: row.likes ?? 0,
        replies: [],
        stake:
          row.stake_amount && row.stake_side
            ? { amount: Number(row.stake_amount), side: row.stake_side }
            : undefined,
      };
      if (row.parent_id) {
        const list = replyMap.get(row.parent_id) ?? [];
        list.push(c);
        replyMap.set(row.parent_id, list);
      } else {
        topLevel.push(c);
      }
    }

    // Attach nested replies and reverse top level so newest is at the top
    return topLevel
      .map((c) => ({ ...c, replies: replyMap.get(c.id) ?? [] }))
      .reverse();
  } catch {
    return [];
  }
}

export async function insertMarketComment(params: {
  marketId: string;
  userId: string;
  userHandle: string;
  text: string;
  stake?: { amount: number; side: string };
  parentId?: string;
}): Promise<Comment | null> {
  try {
    const { data, error } = await supabase
      .from("market_comments")
      .insert({
        market_id: params.marketId,
        user_id: params.userId,
        user_handle: params.userHandle,
        text: params.text,
        parent_id: params.parentId ?? null,
        stake_amount: params.stake?.amount ?? null,
        stake_side: params.stake?.side ?? null,
      })
      .select()
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      user: data.user_handle,
      text: data.text,
      ago: "just now",
      likes: data.likes ?? 0,
      replies: [],
      stake:
        data.stake_amount && data.stake_side
          ? { amount: Number(data.stake_amount), side: data.stake_side }
          : undefined,
    };
  } catch {
    return null;
  }
}

export function appendReply(comments: Comment[], parentId: string, reply: Comment): Comment[] {
  return comments.map((c) =>
    c.id === parentId
      ? { ...c, replies: [...(c.replies ?? []), reply] }
      : c.replies
      ? { ...c, replies: appendReply(c.replies, parentId, reply) }
      : c,
  );
}
