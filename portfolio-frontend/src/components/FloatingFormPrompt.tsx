import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FaRegHandPaper, FaArrowRight, FaTimes } from 'react-icons/fa';
import { X } from 'lucide-react';
import { apiService } from '@/lib/api';
import { getVisitorFingerprint, getSessionIdSync } from '@/hooks/useVisitorTracking';

type UserInfo = {
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
};

export default function FloatingFormPrompt() {
    const [isVisible, setIsVisible] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userInfo, setUserInfo] = useState<UserInfo>({
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
    });

    useEffect(() => {
        // Only show for users who haven't submitted the form
        const formSubmitted = localStorage.getItem('portfolio_form_submitted');
        const dismissed = sessionStorage.getItem('form_prompt_dismissed');

        if (!formSubmitted && !dismissed) {
            // Show after a delay when user has scrolled a bit
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 10000); // 10 seconds delay

            const handleScroll = () => {
                if (window.scrollY > 400 && !formSubmitted) {
                    setIsVisible(true);
                }
            };

            window.addEventListener('scroll', handleScroll);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('scroll', handleScroll);
            };
        }
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
        setIsVisible(false);
        sessionStorage.setItem('form_prompt_dismissed', 'true');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setUserInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            localStorage.setItem('visitorInfo', JSON.stringify(userInfo));
            localStorage.setItem('portfolio_form_submitted', 'true');
            // Preserve existing visit count (user may have visited multiple times before filling the form)
            if (!localStorage.getItem('portfolio_visit_count')) {
                localStorage.setItem('portfolio_visit_count', '1');
            }

            const fingerprint = await getVisitorFingerprint('floating-form');
            const sessionId = getSessionIdSync();

            await apiService.registerVisitor({
                firstName: userInfo.firstName,
                middleName: userInfo.middleName,
                lastName: userInfo.lastName,
                email: userInfo.email,
                fingerprint,
                sessionId
            });

            setIsFormOpen(false);
            setIsVisible(false);

            // Reload to show the personalized greeting
            window.location.reload();
        } catch {
            setIsFormOpen(false);
            setIsVisible(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isDismissed) return null;

    return (
        <>
            {/* Floating Button */}
            <AnimatePresence>
                {isVisible && !isFormOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="fixed bottom-6 right-6 z-50"
                    >
                        <div className="relative group">
                            {/* Glow effect */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-40 group-hover:opacity-70 transition-opacity" />

                            {/* Dismiss button */}
                            <button
                                onClick={handleDismiss}
                                className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>

                            {/* Main button */}
                            <Button
                                onClick={() => setIsFormOpen(true)}
                                className="relative btn-premium rounded-full px-5 py-6 shadow-2xl"
                            >
                                <motion.div
                                    animate={{ rotate: [0, 15, 0, 15, 0] }}
                                    transition={{ repeat: Infinity, duration: 2, delay: 3 }}
                                >
                                    <FaRegHandPaper className="mr-2" />
                                </motion.div>
                                <span className="text-sm font-medium">Say Hello!</span>
                            </Button>

                            {/* Tooltip bubble */}
                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1 }}
                                className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap"
                            >
                                <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm text-foreground">
                                    👋 Introduce yourself!
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-card border-r border-b border-border rotate-[-45deg]" />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Form Modal */}
            <AnimatePresence>
                {isFormOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setIsFormOpen(false);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                            <Card className="w-full max-w-md glass-card border-primary/20 dark:border-primary/10 shadow-2xl relative overflow-hidden">
                                {/* Gradient background */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 dark:from-primary/10 dark:to-accent/10" />

                                <CardHeader className="relative z-10">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-2xl text-foreground flex items-center gap-2">
                                            <motion.div
                                                animate={{ rotate: [0, 15, 0, 15, 0] }}
                                                transition={{ repeat: Infinity, duration: 2 }}
                                                className="text-primary"
                                            >
                                                <FaRegHandPaper />
                                            </motion.div>
                                            Quick Intro
                                        </CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsFormOpen(false)}
                                            className="rounded-full text-muted-foreground hover:text-foreground"
                                        >
                                            <FaTimes />
                                        </Button>
                                    </div>
                                    <CardDescription className="text-muted-foreground">
                                        Let me personalize your experience
                                    </CardDescription>
                                </CardHeader>

                                <form onSubmit={handleSubmit}>
                                    <CardContent className="space-y-4 relative z-10">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="float-firstName" className="text-foreground font-medium">
                                                    First Name
                                                </Label>
                                                <Input
                                                    id="float-firstName"
                                                    name="firstName"
                                                    value={userInfo.firstName}
                                                    onChange={handleChange}
                                                    className="bg-background/50 border-border focus:border-primary"
                                                    placeholder="John"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="float-lastName" className="text-foreground font-medium">
                                                    Last Name
                                                </Label>
                                                <Input
                                                    id="float-lastName"
                                                    name="lastName"
                                                    value={userInfo.lastName}
                                                    onChange={handleChange}
                                                    className="bg-background/50 border-border focus:border-primary"
                                                    placeholder="Doe"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="float-email" className="text-foreground font-medium">
                                                Email
                                            </Label>
                                            <Input
                                                id="float-email"
                                                name="email"
                                                type="email"
                                                value={userInfo.email}
                                                onChange={handleChange}
                                                placeholder="you@example.com"
                                                className="bg-background/50 border-border focus:border-primary"
                                            />
                                        </div>
                                    </CardContent>

                                    <CardFooter className="flex justify-between relative z-10 pt-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setIsFormOpen(false)}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            Maybe Later
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
                                                    <span>Submit</span>
                                                    <FaArrowRight className="ml-2" />
                                                </>
                                            )}
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
