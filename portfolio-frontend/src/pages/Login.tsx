import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setTimeout(() => usernameRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, []);

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result.error) {
        setError(result.error);
        toast.error('Login failed', {
          description: result.error,
        });
      } else {
        toast.success('Login successful!');
        navigate('/home');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error('Login failed', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-pink-950 to-black p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="bg-gradient-to-b from-black to-pink-950 border border-pink-500/20 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-pink-100 flex items-center">
              <LogIn className="mr-2 text-pink-400" />
              Login
            </CardTitle>
            <CardDescription className="text-pink-200/70">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/50 border-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-pink-200">
                  Email or Username
                </Label>
                <Input
                  ref={usernameRef}
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-black/50 border-pink-800/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500"
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-pink-200">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-[11px] text-pink-300 hover:text-pink-200 underline-offset-2 hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleCapsLock}
                    onKeyUp={handleCapsLock}
                    placeholder="Enter your password"
                    className="bg-black/50 border-pink-800/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500 pr-10"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
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
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-800 to-pink-600 hover:from-pink-700 hover:to-pink-500 text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="text-center text-sm text-pink-200/70">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="text-pink-400 hover:text-pink-300 underline"
                >
                  Register here
                </Link>
              </div>

              <div className="text-center text-sm text-pink-200/70">
                <Link
                  to="/"
                  className="text-pink-400 hover:text-pink-300 underline"
                >
                  Back to home
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
        <ForgotPasswordDialog
          open={forgotOpen}
          onClose={() => setForgotOpen(false)}
          initialEmail={username}
        />
      </motion.div>
    </div>
  );
}

