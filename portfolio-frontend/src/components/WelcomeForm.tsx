import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaRegHandPaper, FaArrowRight, FaLinkedin } from 'react-icons/fa';
import { apiService } from '@/lib/api';
import { getVisitorFingerprint, getSessionIdSync } from '@/hooks/useVisitorTracking';

type UserInfo = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  linkedinUrl: string;
};

export default function WelcomeForm() {
  const [userInfo, setUserInfo] = useState<UserInfo>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    linkedinUrl: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkedinError, setLinkedinError] = useState('');
  const navigate = useNavigate();

  const validateLinkedinUrl = (url: string): boolean => {
    if (!url) return true; // optional field
    const pattern = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/;
    return pattern.test(url.trim());
  };

  const normalizeLinkedinUrl = (url: string): string => {
    if (!url) return '';
    let normalized = url.trim();
    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '');
    // Add https:// if missing
    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }
    // Ensure www
    normalized = normalized.replace('://linkedin.com', '://www.linkedin.com');
    return normalized;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserInfo((prev) => ({ ...prev, [name]: value }));
    if (name === 'linkedinUrl') {
      if (value && !validateLinkedinUrl(value)) {
        setLinkedinError('Enter a valid LinkedIn URL (e.g. linkedin.com/in/yourname)');
      } else {
        setLinkedinError('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Store visitor info and mark as visited
      localStorage.setItem('visitorInfo', JSON.stringify(userInfo));
      localStorage.setItem('portfolio_visited', 'true');
      localStorage.setItem('portfolio_visit_count', '1');
      localStorage.setItem('portfolio_form_submitted', 'true');

      // Get fingerprint and session ID for the form submission
      const fingerprint = await getVisitorFingerprint('welcome-form');
      const sessionId = getSessionIdSync();

      // Register visitor with details including session ID and LinkedIn URL
      const linkedinUrl = normalizeLinkedinUrl(userInfo.linkedinUrl);
      await apiService.registerVisitor({
        firstName: userInfo.firstName,
        middleName: userInfo.middleName,
        lastName: userInfo.lastName,
        email: userInfo.email,
        linkedinUrl: linkedinUrl || undefined,
        fingerprint,
        sessionId
      });

      // Navigate to home
      navigate('/home');
    } catch {
      // Silently handle registration failure - still navigate
      navigate('/home');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSkip = () => {
    localStorage.setItem('portfolio_visited', 'true');
    // Initialize visit count so Hero's returning-visitor detection works correctly
    if (!localStorage.getItem('portfolio_visit_count')) {
      localStorage.setItem('portfolio_visit_count', '1');
    }
    navigate('/home');
  };

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{
        y: [0, -8, 0],
        opacity: 1,
        transition: {
          y: { repeat: Infinity, duration: 4, ease: 'easeInOut' },
          opacity: { duration: 0.5 }
        }
      }}
    >
      <Card className="w-full max-w-md glass-card border-primary/20 dark:border-primary/10 shadow-2xl relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 dark:from-primary/10 dark:to-accent/10" />

        <CardHeader className="relative z-10">
          <CardTitle className="text-2xl text-foreground flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 15, 0, 15, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-primary"
            >
              <FaRegHandPaper />
            </motion.div>
            Welcome!
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Please introduce yourself or skip to continue
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 relative z-10">
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                className="space-y-2"
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Label htmlFor="firstName" className="text-foreground font-medium">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={userInfo.firstName}
                  onChange={handleChange}
                  className="bg-background/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  placeholder="John"
                  required
                />
              </motion.div>
              <motion.div
                className="space-y-2"
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Label htmlFor="lastName" className="text-foreground font-medium">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={userInfo.lastName}
                  onChange={handleChange}
                  className="bg-background/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  placeholder="Doe"
                  required
                />
              </motion.div>
            </div>

            <motion.div
              className="space-y-2"
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Label htmlFor="middleName" className="text-foreground font-medium">
                Middle Name
              </Label>
              <Input
                id="middleName"
                name="middleName"
                value={userInfo.middleName}
                onChange={handleChange}
                className="bg-background/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                placeholder="Optional"
              />
            </motion.div>

            <motion.div
              className="space-y-2"
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Label htmlFor="email" className="text-foreground font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={userInfo.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="bg-background/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </motion.div>

            <motion.div
              className="space-y-2"
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Label htmlFor="linkedinUrl" className="text-foreground font-medium flex items-center gap-1.5">
                <FaLinkedin className="text-[#0A66C2]" />
                LinkedIn Profile
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="linkedinUrl"
                name="linkedinUrl"
                type="url"
                value={userInfo.linkedinUrl}
                onChange={handleChange}
                placeholder="linkedin.com/in/yourprofile"
                className={`bg-background/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all ${
                  linkedinError ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30' : ''
                }`}
              />
              {linkedinError && (
                <p className="text-xs text-red-400 mt-1">{linkedinError}</p>
              )}
            </motion.div>
          </CardContent>

          <CardFooter className="flex justify-between relative z-10 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            >
              Skip
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="btn-premium min-w-[120px]"
            >
              {isSubmitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>
                  <span>Continue</span>
                  <FaArrowRight className="ml-2" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
