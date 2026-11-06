import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Btn3D } from "./ui";
import { cn } from "@/lib/utils";
import { ISSUE_CATEGORIES, submitIssue, type IssueCategory } from "@/lib/issues";

export function ReportIssueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [category, setCategory] = useState<IssueCategory>("bug");
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const valid = description.trim().length >= 10;

  const submit = () => {
    if (!valid) return;
    const issue = submitIssue({
      category,
      reference: reference.trim() || undefined,
      contact: contact.trim() || undefined,
      description: description.trim(),
      page: typeof window !== "undefined" ? window.location.pathname : "/",
    });
    toast.success(`Report sent · ${issue.id}`, { description: "Preview only: saved on this device for the ops team." });
    setReference("");
    setContact("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>Tell us what went wrong and we'll look into it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ISSUE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  category === c.id ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Market or M-Pesa receipt ID (optional)" maxLength={60} />
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email for follow-up (optional)" maxLength={80} />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the problem (at least 10 characters)" rows={4} maxLength={1000} />
          <Btn3D variant="primary" className="h-11 w-full" disabled={!valid} onClick={submit}>
            Submit report
          </Btn3D>
        </div>
      </DialogContent>
    </Dialog>
  );
}
