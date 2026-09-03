/**
 * CupolaPlanes — Cupola sovereign architecture (in design and early build).
 *
 * Three stacked planes inside a clearly drawn "customer account" boundary:
 *   L1 Telemetry (metrics, logs, traces, eBPF)
 *   L2 Knowledge Graph (topology, ownership, change, cost)
 *   L3 Agentic (triage, RCA, playbooks)
 * The vendor control plane sits OUTSIDE the boundary, with a one-way arrow
 * inward for patches only. Telemetry never crosses outward — that severed line
 * is the product thesis and the focal point.
 *
 * Cupola is not built. Present-tense design verbs only. Reduced motion => the
 * severed outward line is drawn static (still clearly severed).
 */
import { motion, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { BlockCard, BlockHeader, ScrollableDiagram } from './_shared';

const PLANES = [
  { id: 'l1', title: 'Layer 1 · Telemetry', items: 'metrics · logs · traces · eBPF' },
  { id: 'l2', title: 'Layer 2 · Knowledge Graph', items: 'topology · ownership · change · cost' },
  { id: 'l3', title: 'Layer 3 · Agentic', items: 'triage · RCA · playbooks' }
];

const VIEW_W = 760;
const VIEW_H = 340;

export default function CupolaPlanes() {
  const reduceMotion = useReducedMotion();

  return (
    <BlockCard id="contrib-cupola">
      <BlockHeader
        eyebrow="Cupola · sovereign architecture — in design and early build"
        title="Telemetry that never leaves the customer"
        blurb="Cupola runs inside the customer's own estate. The vendor control plane stays outside the boundary and only pushes patches inward. No telemetry crosses out. That severed line is the whole thesis."
      />

      <ScrollableDiagram minWidth={VIEW_W}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" role="img" aria-label="Cupola sovereign architecture: three planes inside the customer boundary, vendor control plane outside">
          {/* customer account boundary */}
          <rect
            x={30}
            y={30}
            width={480}
            height={280}
            rx={16}
            fill="hsl(var(--primary) / 0.04)"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="8 5"
          />
          <text x={46} y={52} fontSize="12" fontWeight={700} fill="hsl(var(--primary))">
            Customer account (AWS / GCP / Azure / on-prem)
          </text>

          {/* three stacked planes */}
          {PLANES.map((p, i) => {
            const y = 70 + i * 76;
            return (
              <g key={p.id}>
                <rect
                  x={60}
                  y={y}
                  width={420}
                  height={62}
                  rx={10}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth={1.4}
                />
                <text x={78} y={y + 26} fontSize="13" fontWeight={700} fill="hsl(var(--foreground))">
                  {p.title}
                </text>
                <text x={78} y={y + 46} fontSize="11" fill="hsl(var(--muted-foreground))">
                  {p.items}
                </text>
              </g>
            );
          })}

          {/* vendor control plane, OUTSIDE the boundary */}
          <rect
            x={580}
            y={130}
            width={150}
            height={80}
            rx={12}
            fill="hsl(var(--accent) / 0.08)"
            stroke="hsl(var(--accent))"
            strokeWidth={1.6}
          />
          <text x={655} y={162} textAnchor="middle" fontSize="12" fontWeight={700} fill="hsl(var(--accent))">
            Vendor
          </text>
          <text x={655} y={180} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
            control plane
          </text>

          {/* one-way arrow inward: patches only */}
          <defs>
            <marker id="cupola-arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 Z" fill="hsl(var(--accent))" />
            </marker>
          </defs>
          <line x1={578} y1={170} x2={488} y2={170} stroke="hsl(var(--accent))" strokeWidth={2} markerEnd="url(#cupola-arrow)" />
          <text x={533} y={162} textAnchor="middle" fontSize="10" fill="hsl(var(--accent))">
            patches only
          </text>

          {/* severed outward telemetry line — the focal point */}
          <g>
            <line x1={488} y1={230} x2={548} y2={230} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 4" />
            {/* the cut */}
            <line x1={552} y1={218} x2={568} y2={242} stroke="hsl(var(--destructive))" strokeWidth={3} />
            <line x1={568} y1={218} x2={552} y2={242} stroke="hsl(var(--destructive))" strokeWidth={3} />
            <text x={520} y={222} textAnchor="middle" fontSize="10" fill="hsl(var(--destructive))" fontWeight={700}>
              telemetry
            </text>
            {reduceMotion ? (
              <text x={604} y={234} fontSize="10" fill="hsl(var(--destructive))" fontWeight={700}>
                never leaves
              </text>
            ) : (
              <motion.text
                x={604}
                y={234}
                fontSize="10"
                fill="hsl(var(--destructive))"
                fontWeight={700}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                never leaves
              </motion.text>
            )}
          </g>
        </svg>
      </ScrollableDiagram>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">In design and early build.</span> Cold tier is plain
          Parquet in the customer's own bucket — still queryable by DuckDB or Athena with Cupola uninstalled.
        </p>
      </div>
    </BlockCard>
  );
}
