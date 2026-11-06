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

export function saveMarketComments(id: string, comments: Comment[]): boolean {
  try {
    localStorage.setItem(marketCommentsKey(id), JSON.stringify(comments));
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