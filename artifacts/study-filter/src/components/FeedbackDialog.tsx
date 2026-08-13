import React from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { Mail } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";

const CATEGORIES = [
  { value: "wrong_answer", label: "An answer looks wrong" },
  { value: "broken_pdf", label: "A PDF is missing or won't open" },
  { value: "bug", label: "Something is broken" },
  { value: "suggestion", label: "I have a suggestion" },
  { value: "other", label: "Something else" },
] as const;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra context to attach automatically — e.g. { subject, chapter, question }. */
  context?: Record<string, unknown>;
}

/**
 * A mailto: link is a dead end on a phone with no mail client configured —
 * it opens nothing and the report is lost. This stores the report directly,
 * and offers feedback@contact.studyfilter.online as the escalation path for
 * anything urgent rather than the only channel.
 *
 * That address, not support@studyfilter.online: the root domain has no MX
 * record, so support@ silently bounces everything sent to it. contact. is
 * the subdomain actually verified with Resend, with inbound receiving wired
 * to a webhook (routes/webhooks.ts on the API server) that relays anything
 * sent here to a real inbox.
 */
export function FeedbackDialog({ open, onOpenChange, context }: FeedbackDialogProps) {
  const [location] = useLocation();
  const sessionId = useSession();
  const { toast } = useToast();

  const [category, setCategory] = React.useState<string>("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function reset() {
    setCategory("");
    setMessage("");
  }

  async function handleSubmit() {
    if (!category || message.trim().length < 5 || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          category,
          message: message.trim(),
          pageContext: location,
          context,
        }),
      });
      if (!res.ok) throw new Error("request failed");

      toast({ title: "Thanks — we read every report." });
      reset();
      onOpenChange(false);
    } catch {
      toast({
        title: "Could not send your report",
        description: "Please try again, or email feedback@contact.studyfilter.online.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an issue or share feedback</DialogTitle>
          <DialogDescription>
            We read every report. For anything urgent, email{" "}
            <a href="mailto:feedback@contact.studyfilter.online" className="text-primary underline">
              feedback@contact.studyfilter.online
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="What's this about?" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what happened — the more specific, the faster we can fix it."
            rows={5}
            maxLength={2000}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" asChild>
            <a href="mailto:feedback@contact.studyfilter.online">
              <Mail className="mr-1.5 h-4 w-4" />
              Email instead
            </a>
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !category || message.trim().length < 5}
          >
            {submitting && <Spinner className="mr-1.5" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
