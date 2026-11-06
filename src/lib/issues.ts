import { useSyncExternalStore } from "react";

export type IssueCategory = "market" | "mpesa" | "bug" | "account" | "other";
export type IssueStatus = "open" | "investigating" | "resolved";
export type Issue = {
  id: string;
  category: IssueCategory;
  reference?: string | undefined;
  description: string;
  contact?: string | undefined;
  page: string;
  status: IssueStatus;
  createdAt: number;
};

export const ISSUE_CATEGORIES: { id: IssueCategory; label: string }[] = [
  { id: "market", label: "Market dispute" },
  { id: "mpesa", label: "M-Pesa transaction" },
  { id: "bug", label: "Bug / app problem" },
  { id: "account", label: "Account & login" },
  { id: "other", label: "Something else" },
];

const KEY = "polka-issues";
const listeners = new Set<() => void>();
let cache: Issue[] | null = null;
const EMPTY: Issue[] = [];

function read(): Issue[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Issue[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: Issue[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function submitIssue(input: Omit<Issue, "id" | "status" | "createdAt">): Issue {
  const issue: Issue = {
    ...input,
    id: `ISS-${Date.now().toString(36).toUpperCase()}`,
    status: "open",
    createdAt: Date.now(),
  };
  write([issue, ...read()]);
  return issue;
}

export function setIssueStatus(id: string, status: IssueStatus) {
  write(read().map((i) => (i.id === id ? { ...i, status } : i)));
}

export function useIssues(): Issue[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
}
