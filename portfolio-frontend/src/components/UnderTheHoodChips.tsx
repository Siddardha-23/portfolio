import { motion, AnimatePresence } from 'framer-motion';
import { useUnderTheHood } from '@/contexts/UnderTheHoodContext';
import type { ChipDef } from '@/lib/underTheHoodData';
import {
    Cloud,
    Database,
    Shield,
    Globe,
    Cpu,
    KeyRound,
    Bot,
    BarChart3,
    Search,
    FileText,
    HardDrive,
    Terminal,
    Zap,
    GitBranch,
} from 'lucide-react';

const ICON_MAP: Record<ChipDef['icon'], React.ElementType> = {
    cloud: Cloud,
    lambda: Zap,
    database: Database,
    cicd: GitBranch,
    shield: Shield,
    globe: Globe,
    cpu: Cpu,
    key: KeyRound,
    bot: Bot,
    chart: BarChart3,
    search: Search,
    file: FileText,
    cache: HardDrive,
    terminal: Terminal,
};

const COLOR_MAP: Record<string, string> = {
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/25',
    orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25 hover:bg-orange-500/25',
    green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25 hover:bg-blue-500/25',
    violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25 hover:bg-violet-500/25',
    red: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25 hover:bg-red-500/25',
};

interface UnderTheHoodChipsProps {
    featureId: string;
    chips: ChipDef[];
    className?: string;
}

export default function UnderTheHoodChips({ featureId, chips, className = '' }: UnderTheHoodChipsProps) {
    const { enabled, openDrawer } = useUnderTheHood();

    return (
        <AnimatePresence>
            {enabled && (
                <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`flex flex-wrap gap-1.5 ${className}`}
                >
                    {chips.map((chip, i) => {
                        const Icon = ICON_MAP[chip.icon] || Cpu;
                        const colorClass = COLOR_MAP[chip.color] || COLOR_MAP.blue;

                        return (
                            <motion.button
                                key={chip.label}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.06, duration: 0.2 }}
                                onClick={() => openDrawer(featureId)}
                                className={`
                  inline-flex items-center gap-1 px-2 py-0.5
                  text-[10px] font-medium tracking-wide uppercase
                  rounded-full border cursor-pointer
                  transition-all duration-200
                  ${colorClass}
                `}
                                title={`Click to see how "${chip.label}" works under the hood`}
                            >
                                <Icon className="h-2.5 w-2.5" />
                                {chip.label}
                            </motion.button>
                        );
                    })}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
