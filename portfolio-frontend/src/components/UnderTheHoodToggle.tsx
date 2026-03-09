import { motion, AnimatePresence } from 'framer-motion';
import { Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnderTheHood } from '@/contexts/UnderTheHoodContext';

export function UnderTheHoodToggle() {
    const { enabled, toggle } = useUnderTheHood();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className={`
        relative rounded-full w-10 h-10 overflow-hidden transition-all duration-300
        ${enabled
                    ? 'bg-primary/15 hover:bg-primary/25 ring-1 ring-primary/30'
                    : 'bg-secondary/50 hover:bg-secondary'
                }
      `}
            aria-label={enabled ? 'Disable Under the Hood mode' : 'Enable Under the Hood mode'}
            title={enabled ? 'Under the Hood: ON' : 'Under the Hood: OFF'}
            id="under-the-hood-toggle"
        >
            <AnimatePresence mode="wait" initial={false}>
                {enabled ? (
                    <motion.div
                        key="on"
                        initial={{ rotate: -90, opacity: 0, scale: 0 }}
                        animate={{ rotate: 0, opacity: 1, scale: 1 }}
                        exit={{ rotate: 90, opacity: 0, scale: 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Code2 className="h-5 w-5 text-primary" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="off"
                        initial={{ rotate: 90, opacity: 0, scale: 0 }}
                        animate={{ rotate: 0, opacity: 1, scale: 1 }}
                        exit={{ rotate: -90, opacity: 0, scale: 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Code2 className="h-5 w-5 text-foreground" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pulsing ring indicator when active */}
            {enabled && (
                <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
            )}
        </Button>
    );
}
