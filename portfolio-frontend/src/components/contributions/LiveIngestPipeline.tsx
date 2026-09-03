/**
 * LiveIngestPipeline — Standup AI ingest architecture.
 *
 * Horizontal flow, animated. Two branches:
 *   live:  Meeting -> webhook (~2s) -> per-bot ring buffer -> 30s flush ->
 *          Gemini 2.5 Flash -> delta extraction -> Live graph
 *   close: bot.done -> Claude Sonnet (prompt-cached) -> Corpus rebuild ->
 *          Unified graph -> human approval queue -> Slack / Linear
 *
 * Small pulse every 2s, larger batch pulse every 30s. Nodes brighten as a
 * pulse arrives. The approval gate is labelled: nothing reaches Slack/Linear
 * without a human. Reduced motion => static, readable diagram.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { BlockCard, BlockHeader, ScrollableDiagram } from './_shared';

type Node = { id: string; label: string; sub?: string; x: number; y: number };

const NODE_W = 118;
const NODE_H = 52;

// Live branch (top row)
const LIVE: Node[] = [
  { id: 'meeting', label: 'Meeting', x: 20, y: 40 },
  { id: 'webhook', label: 'Transcript webhook', sub: '~2s', x: 170, y: 40 },
  { id: 'buffer', label: 'Per-bot ring buffer', x: 320, y: 40 },
  { id: 'flush', label: '30s chunk flush', x: 470, y: 40 },
  { id: 'gemini', label: 'Gemini 2.5 Flash', x: 620, y: 40 },
  { id: 'delta', label: 'Delta extraction', x: 770, y: 40 },
  { id: 'live', label: 'Live graph', x: 920, y: 40 }
];

// Close branch (bottom row)
const CLOSE: Node[] = [
  { id: 'done', label: 'bot.done', x: 320, y: 150 },
  { id: 'claude', label: 'Claude Sonnet', sub: 'prompt-cached', x: 470, y: 150 },
  { id: 'corpus', label: 'Corpus rebuild', x: 620, y: 150 },
  { id: 'unified', label: 'Unified graph', x: 770, y: 150 },
  { id: 'approval', label: 'Human approval', sub: 'gate', x: 920, y: 150 },
  { id: 'out', label: 'Slack / Linear', x: 1070, y: 150 }
];

const ALL = [...LIVE, ...CLOSE];
const byId = Object.fromEntries(ALL.map((n) => [n.id, n]));

const LIVE_EDGES = ['meeting>webhook', 'webhook>buffer', 'buffer>flush', 'flush>gemini', 'gemini>delta', 'delta>live'];
const CLOSE_EDGES = ['done>claude', 'claude>corpus', 'corpus>unified', 'unified>approval', 'approval>out'];
// Live graph feeds corpus rebuild at close, and buffer emits bot.done.
const CROSS_EDGES = ['buffer>done', 'live>corpus'];

const VIEW_W = 1210;
const VIEW_H = 220;

function center(n: Node) {
  return { cx: n.x + NODE_W / 2, cy: n.y + NODE_H / 2 };
}

function edgePath(from: Node, to: Node) {
  const a = center(from);
  const b = center(to);
  const mx = (a.cx + b.cx) / 2;
  return `M ${a.cx} ${a.cy} C ${mx} ${a.cy}, ${mx} ${b.cy}, ${b.cx} ${b.cy}`;
}

export default function LiveIngestPipeline() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState(false);

  // Travel a pulse along a sequence of node ids, brightening each in turn.
  useEffect(() => {
    if (reduceMotion) return;
    const timers: number[] = [];

    const travel = (ids: string[], step: number) => {
      ids.forEach((id, i) => {
        const t = window.setTimeout(() => {
          setActive((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          window.setTimeout(() => {
            setActive((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }, step * 1.8);
        }, i * step);
        timers.push(t);
      });
    };

    // Small pulse every 2s along the live path.
    const smallSeq = ['meeting', 'webhook', 'buffer'];
    const small = window.setInterval(() => travel(smallSeq, 180), 2000);

    // Batch pulse every 30s: full live flush + close branch.
    const batchSeq = ['flush', 'gemini', 'delta', 'live', 'corpus', 'unified', 'approval', 'out'];
    const big = window.setInterval(() => {
      setBatch(true);
      window.setTimeout(() => setBatch(false), 1600);
      travel(batchSeq, 200);
    }, 30000);

    // Kick one of each shortly after mount so it is visibly alive.
    travel(smallSeq, 180);
    const kick = window.setTimeout(() => {
      setBatch(true);
      window.setTimeout(() => setBatch(false), 1600);
      travel(batchSeq, 200);
    }, 1200);

    return () => {
      clearInterval(small);
      clearInterval(big);
      clearTimeout(kick);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [reduceMotion]);

  const renderNode = (n: Node) => {
    const on = active.has(n.id) || reduceMotion;
    const isGate = n.id === 'approval';
    return (
      <g key={n.id}>
        <rect
          x={n.x}
          y={n.y}
          width={NODE_W}
          height={NODE_H}
          rx={10}
          fill={on ? 'hsl(var(--primary) / 0.16)' : 'hsl(var(--card))'}
          stroke={isGate ? 'hsl(var(--accent))' : on ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
          strokeWidth={isGate ? 2 : on ? 1.6 : 1}
          style={{ transition: 'fill 250ms ease, stroke 250ms ease' }}
        />
        <text
          x={n.x + NODE_W / 2}
          y={n.y + (n.sub ? 22 : 30)}
          textAnchor="middle"
          fontSize="11"
          fontWeight={600}
          fill="hsl(var(--foreground))"
        >
          {n.label}
        </text>
        {n.sub && (
          <text
            x={n.x + NODE_W / 2}
            y={n.y + 38}
            textAnchor="middle"
            fontSize="9.5"
            fill="hsl(var(--muted-foreground))"
          >
            {n.sub}
          </text>
        )}
      </g>
    );
  };

  const renderEdge = (key: string, kind: 'live' | 'close' | 'cross') => {
    const [f, t] = key.split('>');
    const from = byId[f];
    const to = byId[t];
    if (!from || !to) return null;
    const isBatch = kind !== 'live' && batch;
    return (
      <path
        key={key}
        d={edgePath(from, to)}
        fill="none"
        stroke={
          kind === 'cross'
            ? 'hsl(var(--muted-foreground) / 0.4)'
            : isBatch
              ? 'hsl(var(--accent))'
              : 'hsl(var(--primary) / 0.5)'
        }
        strokeWidth={kind === 'cross' ? 1.2 : 2}
        strokeDasharray={kind === 'cross' ? '4 4' : undefined}
        style={{ transition: 'stroke 250ms ease' }}
      />
    );
  };

  return (
    <BlockCard id="contrib-ingest">
      <BlockHeader
        eyebrow="Standup AI · pipeline"
        title="The live ingest pipeline"
        blurb="Transcript webhooks verified every two seconds, buffered per bot, flushed in 30-second chunks to Gemini, keeping Live, Corpus and Unified graphs in step. At meeting close, prompt-cached Claude rebuilds the corpus."
      />

      <ScrollableDiagram minWidth={VIEW_W}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" role="img" aria-label="Standup AI ingest pipeline flow diagram">
          {/* branch labels */}
          <text x={20} y={20} fontSize="10" fontWeight={700} fill="hsl(var(--primary))" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Live · every meeting
          </text>
          <text x={320} y={130} fontSize="10" fontWeight={700} fill="hsl(var(--accent))" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            At meeting close
          </text>

          {CROSS_EDGES.map((e) => renderEdge(e, 'cross'))}
          {LIVE_EDGES.map((e) => renderEdge(e, 'live'))}
          {CLOSE_EDGES.map((e) => renderEdge(e, 'close'))}
          {ALL.map(renderNode)}
        </svg>
      </ScrollableDiagram>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
        <ShieldCheck className="h-4 w-4 text-accent mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Human in the loop.</span> Nothing reaches Slack or Linear
          without passing the approval gate.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--primary))' }} /> Small pulse ~ every 2s</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--accent))' }} /> Batch flush ~ every 30s</span>
      </div>
    </BlockCard>
  );
}
