import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { apiService } from '@/lib/api';

interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
}

/**
 * Forgot-password dialog — collects the user's email and asks the backend
 * to issue a reset token. Backend response is deliberately generic ("if that
 * email is registered, a link is on the way") so an attacker can't probe
 * which addresses have accounts.
 */
export function ForgotPasswordDialog({ open, onClose, initialEmail = '' }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setSent(false);
    setError(null);
  }, [open, initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter the email you registered with.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await apiService.requestPasswordReset(email.trim());
      if (resp.error) {
        setError(resp.error);
      } else {
        setSent(true);
      }
    } catch {
      setError('Network issue — try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Reset your password
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enter the email you registered with. We'll send a reset link if it
            matches an account — for privacy we don't disclose whether an
            address is registered.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-medium">Request received</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If <span className="font-mono">{email}</span> is registered, a
              reset link is on its way. The link is valid for 30 minutes. Check
              spam too. If you don't receive anything within 5 minutes, contact
              support.
            </p>
            <div className="flex justify-end">
              <Button onClick={onClose} size="sm">Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                required
                disabled={submitting}
              />
            </div>
            {error && (
              <p className="text-xs text-rose-500">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={submitting}
                size="sm"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} size="sm">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
