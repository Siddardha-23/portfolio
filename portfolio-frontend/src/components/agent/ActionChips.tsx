/**
 * ActionChips — next-best-action prompts the agent suggests at end of a turn.
 *
 * Clean glass chips with subtle hover. Each chip submits its `value` as the
 * next user message — turning the conversation into a guided funnel without
 * forcing the user to know what to ask.
 */
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { AgentAction } from "@/hooks/useBuilderAgent";

interface Props {
  actions: AgentAction[];
  onSelect: (value: string) => void;
}

export function ActionChips({ actions, onSelect }: Props) {
  if (actions.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-wrap gap-1.5 pl-1"
    >
      {actions.map((a, i) => (
        <motion.button
          key={a.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          onClick={() => onSelect(a.value || a.label)}
          className="group inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary transition-colors"
        >
          {a.label}
          <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      ))}
    </motion.div>
  );
}
