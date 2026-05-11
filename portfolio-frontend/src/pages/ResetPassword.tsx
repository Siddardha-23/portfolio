import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from 'framer-motion';
import { KeyRound, AlertCircle, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/api';

/**
 * Consumes a `?token=` query param from the reset email and posts the new
 * password to /api/auth/reset-password. On success, redirects to /login
 * after a short pause so the user sees the confirmation.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => (params.get('token') || '').trim(), [params]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError('No reset token in the URL. Request a new link.');
  }, [token]);

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const passwordsMatch = password.length > 0 && password === confirm;
  const longEnough = password.length >= 8;
  const canSubmit = !!token && longEnough && passwordsMatch && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const resp = await apiService.resetPassword(token, password);
      if (resp.error) {
        setError(resp.error);
        toast.error('Reset failed', { description: resp.error });
        return;
      }
      setDone(true);
      toast.success('Password updated — redirecting to sign in.');
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch {
      setError('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-pink-950 to-black p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md"
      >
        <Card className="bg-gradient-to-b from-black to-pink-950 border border-pink-500/20 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-pink-100 flex items-center">
              <KeyRound className="mr-2 text-pink-400" />
              Set a new password
            </CardTitle>
            <CardDescription className="text-pink-200/70">
              Pick something at least 8 characters. You'll be signed in fresh.
            </CardDescription>
          </CardHeader>

          {done ? (
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">Password updated</p>
              </div>
              <p className="text-xs text-pink-200/70">Redirecting to sign in…</p>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="bg-red-900/50 border-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-pink-200">
                    New password
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleCapsLock}
                      onKeyUp={handleCapsLock}
                      placeholder="At least 8 characters"
                      className="bg-black/50 border-pink-800/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500 pr-10"
                      autoComplete="new-password"
                      required
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-pink-300/70 hover:text-pink-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {capsLockOn && (
                    <p className="text-[11px] text-amber-400 inline-flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Caps Lock is on
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-pink-200">
                    Confirm
                  </Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-type the same password"
                    className={`bg-black/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500 ${
                      confirm && !passwordsMatch
                        ? 'border-red-500'
                        : passwordsMatch
                        ? 'border-green-500'
                        : 'border-pink-800/50'
                    }`}
                    autoComplete="new-password"
                    required
                    disabled={submitting}
                  />
                  {confirm && !passwordsMatch && (
                    <p className="text-[11px] text-red-400">Passwords do not match.</p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full bg-gradient-to-r from-pink-800 to-pink-600 hover:from-pink-700 hover:to-pink-500 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
                <Link to="/login" className="text-xs text-pink-300 hover:text-pink-200 underline-offset-2 hover:underline">
                  Back to sign in
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
