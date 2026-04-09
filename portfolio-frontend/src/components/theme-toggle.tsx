import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Resolve effective theme for icon display
  const effective =
    theme === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

  const toggleTheme = () => setTheme(effective === 'dark' ? 'light' : 'dark');

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative rounded-full w-10 h-10 bg-secondary/50 hover:bg-secondary overflow-hidden transition-colors duration-300"
      aria-label={`Switch to ${effective === 'dark' ? 'light' : 'dark'} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {effective === 'dark' ? (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sun className="h-5 w-5 text-foreground" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Moon className="h-5 w-5 text-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
}
