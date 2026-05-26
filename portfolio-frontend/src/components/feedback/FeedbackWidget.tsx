import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ── Context so anywhere in the app can call openFeedback({type, prefill}) ──

type FeedbackType = "general" | "quota_bump" | "bug" | "idea";

interface OpenOpts {
  type?: FeedbackType;
  prefill?: string;
  title?: string;
}

interface FeedbackContextValue {
  open: (opts?: OpenOpts) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    // Soft fallback so callers don't crash if the provider isn't mounted yet.
    return { open: () => undefined } as FeedbackContextValue;
  }
  return ctx;
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  general: "General feedback",
  idea: "Idea / feature request",
  bug: "Report a bug",
  quota_bump: "Request more tailors",
};

const TYPE_PLACEHOLDERS: Record<FeedbackType, string> = {
  general: "What's on your mind? Anything that worked well, broke, or felt off…",
  idea: "Describe the feature or change you'd like to see.",
  bug: "What happened, what did you expect, and how can I reproduce it?",
  quota_bump:
    "Tell me a bit about your job-hunt push (target roles, how many resumes you're aiming to send this week) and I'll bump your limit.",
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);

  const handleOpen = useCallback((opts?: OpenOpts) => {
    if (opts?.type) setType(opts.type);
    if (opts?.prefill) setMessage(opts.prefill);
    setTitleOverride(opts?.title ?? null);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ open: handleOpen }), [handleOpen]);

  const submit = async () => {
    if (!message.trim()) {
      toast.error("Tell me what you're thinking — message can't be blank.");
      return;
    }
    setSubmitting(true);
    const resp = await apiService.submitFeedback(message.trim(), type);
    setSubmitting(false);
    if (resp.error) {
      toast.error(resp.error || "Could not send feedback. Try again in a moment.");
      return;
    }
    toast.success("Thanks — feedback received. I read every one.");
    setMessage("");
    setOpen(false);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {/* Floating launcher — vertically rotated tab on the LEFT edge so it
          never collides with the bottom-right cluster (Chatbot, Concierge,
          BuilderAgent, ResumeParser's sticky action bar). Vertically
          centered → always within thumb reach on desktop. */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={() => handleOpen()}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 group inline-flex items-center gap-1.5 rounded-r-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 px-2.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 hover:px-3.5 active:scale-95 transition-all"
          style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
          aria-label="Send feedback"
        >
          <ChatBubbleIcon />
          <span>Feedback</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {titleOverride ?? (type === "quota_bump" ? "Request more daily tailors" : "Send feedback")}
            </DialogTitle>
            <DialogDescription>
              Goes straight to me. I read every one and act on the most-asked stuff first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(Object.keys(TYPE_LABELS) as FeedbackType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      type === t
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/60 hover:border-border bg-background"
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="feedback-msg" className="text-xs uppercase tracking-wide text-muted-foreground">
                Message
              </Label>
              <Textarea
                id="feedback-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={TYPE_PLACEHOLDERS[type]}
                rows={6}
                maxLength={4000}
                className="mt-2 resize-none"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{message.length} / 4000</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || !message.trim()}>
              {submitting ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-90 group-hover:opacity-100"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// Silence unused-import warning for useEffect — kept in case future logic
// (e.g., open-on-mount when ?feedback=1) wants it without re-edits.
void useEffect;
