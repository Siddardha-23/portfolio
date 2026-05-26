import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DailyUsage } from "@/hooks/useDailyUsage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Usage snapshot from the 429 response (or `null` to suppress numbers). */
  usage: (DailyUsage & { requested?: number }) | null;
  /** Optional callback to open the feedback widget directly. */
  onRequestMore?: () => void;
}

function formatResetCountdown(resetIso?: string) {
  if (!resetIso) return null;
  const resetMs = new Date(resetIso).getTime();
  const diffMs = resetMs - Date.now();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function QuotaLimitDialog({ open, onOpenChange, usage, onRequestMore }: Props) {
  const limit = usage?.limit ?? 5;
  const used = usage?.used ?? limit;
  const requested = usage?.requested;
  const countdown = formatResetCountdown(usage?.resets_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Daily tailoring limit reached</DialogTitle>
          <DialogDescription className="pt-2 text-base leading-relaxed">
            You've used{" "}
            <span className="font-semibold text-foreground">
              {used} of {limit}
            </span>{" "}
            tailored resumes for today.
            {requested && requested > (usage?.remaining ?? 0) ? (
              <>
                {" "}
                That batch of <span className="font-semibold">{requested}</span> would push you over —
                trim it down or come back tomorrow.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
          <p>
            I cap this at <span className="font-medium text-foreground">{limit} per day</span> so the
            AI tailoring (powered by Claude) stays free for everyone — every tailor runs a few large
            model calls under the hood, and unlimited use would burn the budget fast.
          </p>
          <p>
            Your counter resets at <span className="font-medium text-foreground">midnight UTC</span>
            {countdown ? (
              <>
                {" "}
                — about <span className="font-medium text-foreground">{countdown}</span> from now.
              </>
            ) : (
              "."
            )}{" "}
            If you're in the middle of an active job-hunt push and need more headroom, drop a quick
            note and I'll bump your limit.
          </p>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
          {onRequestMore && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onRequestMore();
              }}
            >
              Request more
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
