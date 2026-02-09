import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { UserPlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }

    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(username, password, email || undefined);
      if (result.error) {
        setError(result.error);
        toast.error('Registration failed', {
          description: result.error,
        });
      } else {
        toast.success('Registration successful!');
        navigate('/home');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error('Registration failed', {
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
              <UserPlus className="mr-2 text-pink-400" />
              Register
            </CardTitle>
            <CardDescription className="text-pink-200/70">
              Create a new account to get started
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
                  Username <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username (min 3 characters)"
                  className="bg-black/50 border-pink-800/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-pink-200">
                  Email (optional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="bg-black/50 border-pink-800/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-pink-200">
                  Password <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  className="bg-black/50 border-pink-800/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-pink-200">
                  Confirm Password <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="bg-black/50 border-pink-800/50 text-pink-100 placeholder:text-pink-300/30 focus:border-pink-500"
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-800 to-pink-600 hover:from-pink-700 hover:to-pink-500 text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Registering...' : 'Register'}
              </Button>

              <div className="text-center text-sm text-pink-200/70">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-pink-400 hover:text-pink-300 underline"
                >
                  Login here
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
      </motion.div>
    </div>
  );
}

