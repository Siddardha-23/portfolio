/**
 * IsolationRings — Standup AI four-level tenancy.
 * Concentric rings: Tenant -> Workspace -> Layer -> Scope.
 * Hover/tap a ring to reveal the mechanism enforcing it. A short looping
 * animation shows a cross-tenant request rejected at the outer boundary.
 * Reduced motion => rings static, rejection shown as a static state.
 */
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BlockCard, BlockHeader } from './_shared';

type Ring = { id: string; label: string; mechanism: string; r: number };

const RINGS: Ring[] = [
  { id: 'tenant', label: 'Tenant', mechanism: 'Postgres row-level security', r: 140 },
  { id: 'workspace', label: 'Workspace', mechanism: 'Per-workspace storage', r: 106 },
  { id: 'layer', label: 'Layer', mechanism: 'Fail-closed route registration', r: 72 },
  { id: 'scope', label: 'Scope', mechanism: 'HMAC + replay protection', r: 40 }
];

const SIZE = 320;
const C = SIZE / 2;

export default function IsolationRings() {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string>('tenant');
  const active = RINGS.find((r) => r.id === activeId)!;

  return (
    <BlockCard id="contrib-isolation">
      <BlockHeader
        eyebrow="Standup AI · isolation"
        title="Four-level tenant isolation"
        blurb="Tenant, workspace, layer and scope. Each boundary is enforced by a distinct mechanism. Hover or tap a ring to see how."
      />

      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="flex justify-center">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 320 }} role="img" aria-label="Four concentric isolation rings">
            {/* rejected cross-tenant request, arriving from top-left and bouncing off the outer ring */}
            {!reduceMotion ? (
              <motion.circle
                r={5}
                fill="hsl(var(--destructive))"
                initial={{ cx: 10, cy: 10, opacity: 0 }}
                animate={{
                  cx: [10, C - RINGS[0].r - 6, C - RINGS[0].r - 22, 10],
                  cy: [10, C - RINGS[0].r - 6, C - RINGS[0].r - 22, 10],
                  opacity: [0, 1, 1, 0]
                }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.6, 1] }}
              />
            ) : (
              <circle cx={12} cy={12} r={5} fill="hsl(var(--destructive))" />
            )}

            {RINGS.map((ring) => {
              const on = ring.id === activeId;
              return (
                <g
                  key={ring.id}
                  onMouseEnter={() => setActiveId(ring.id)}
                  onClick={() => setActiveId(ring.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={C}
                    cy={C}
                    r={ring.r}
                    fill={on ? 'hsl(var(--primary) / 0.10)' : 'transparent'}
                    stroke={on ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                    strokeWidth={on ? 2.5 : 1.5}
                    style={{ transition: 'stroke 200ms ease, fill 200ms ease' }}
                  />
                  <text
                    x={C}
                    y={C - ring.r + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={700}
                    fill={on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                  >
                    {ring.label}
                  </text>
                </g>
              );
            })}
            {/* rejection marker on outer boundary */}
            <text x={C} y={16} textAnchor="middle" fontSize="10" fontWeight={700} fill="hsl(var(--destructive))">
              cross-tenant → rejected
            </text>
          </svg>
        </div>

        <div>
          <div className="space-y-2">
            {RINGS.map((ring) => {
              const on = ring.id === activeId;
              return (
                <button
                  key={ring.id}
                  onMouseEnter={() => setActiveId(ring.id)}
                  onFocus={() => setActiveId(ring.id)}
                  onClick={() => setActiveId(ring.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    on ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{ring.label}</span>
                    <span className="text-[11px] text-muted-foreground">{ring.mechanism}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Enforced by</div>
            <div className="text-sm font-semibold text-foreground">{active.mechanism}</div>
          </div>
        </div>
      </div>
    </BlockCard>
  );
}
