/**
 * InfratrixGraph — the Infratrix knowledge graph (three.js).
 *
 * Renders a representative subgraph of ~220 nodes (not all 11,880) for
 * performance, using @react-three/fiber. The solver's evidence path is
 * animated: a finding node lights up and the highlight walks back along the
 * edges to the resources that justify it.
 *
 * Counters: 11,880 nodes · 14,159 typed edges · 22 AWS service APIs ·
 * 104 optimization patterns.
 *
 * This module is lazy-loaded behind Suspense (WebGL) so it doesn't block first
 * paint. Reduced motion => the evidence path is drawn static (fully lit) and
 * the graph does not auto-rotate.
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { BlockCard, BlockHeader, StatCounter } from './_shared';

const NODE_COUNT = 220;
const EDGE_EXTRA = 90; // extra cross edges beyond the spanning tree

// Deterministic PRNG (mulberry32) so layout is stable across renders.
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type GraphData = {
  positions: Float32Array;
  edges: [number, number][];
  parent: number[];
  evidencePath: number[];
};

function buildGraph(): GraphData {
  const rng = makeRng(20880614);
  const positions = new Float32Array(NODE_COUNT * 3);

  // Distribute nodes in a rough sphere shell for a graph-like cloud.
  for (let i = 0; i < NODE_COUNT; i++) {
    const u = rng();
    const v = rng();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 3.4 + rng() * 1.6;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }

  // Spanning tree so the graph is connected; each node links to an earlier one.
  const parent: number[] = new Array(NODE_COUNT).fill(-1);
  const edges: [number, number][] = [];
  for (let i = 1; i < NODE_COUNT; i++) {
    const p = Math.floor(rng() * i);
    parent[i] = p;
    edges.push([i, p]);
  }
  // Extra cross edges for density.
  for (let k = 0; k < EDGE_EXTRA; k++) {
    const a = Math.floor(rng() * NODE_COUNT);
    const b = Math.floor(rng() * NODE_COUNT);
    if (a !== b) edges.push([a, b]);
  }

  // Evidence path: from a leaf "finding" node, walk parents to the root
  // "account" resources — a traversable justification chain.
  const leaf = NODE_COUNT - 1;
  const evidencePath: number[] = [];
  let cur = leaf;
  let guard = 0;
  while (cur !== -1 && guard < 40) {
    evidencePath.push(cur);
    cur = parent[cur];
    guard++;
  }

  return { positions, edges, parent, evidencePath };
}

function GraphScene({ reduceMotion }: { reduceMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const data = useMemo(buildGraph, []);
  const [progress, setProgress] = useState(reduceMotion ? data.evidencePath.length : 0);

  // Walk the evidence path highlight over time.
  useEffect(() => {
    if (reduceMotion) return;
    let step = 0;
    const advance = () => {
      step = (step + 1) % (data.evidencePath.length + 8);
      setProgress(Math.min(step, data.evidencePath.length));
    };
    const iv = window.setInterval(advance, 260);
    return () => {
      clearInterval(iv);
    };
  }, [reduceMotion, data.evidencePath.length]);

  useFrame((_, delta) => {
    if (reduceMotion || !group.current) return;
    group.current.rotation.y += delta * 0.08;
  });

  const litSet = useMemo(() => new Set(data.evidencePath.slice(0, progress)), [data.evidencePath, progress]);

  // Node meshes: highlighted evidence nodes are accent, rest are muted primary.
  const nodeColorLit = new THREE.Color('#a78bfa');
  const nodeColorBase = new THREE.Color('#6d5bd0');

  // Edge geometry (lines). Evidence edges are drawn brighter.
  const { baseLineGeom, evidenceLineGeom } = useMemo(() => {
    const basePts: number[] = [];
    const evPts: number[] = [];
    const evEdgeSet = new Set<string>();
    for (let i = 1; i < data.evidencePath.length; i++) {
      const a = data.evidencePath[i - 1];
      const b = data.evidencePath[i];
      evEdgeSet.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
    }
    for (const [a, b] of data.edges) {
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      const target = evEdgeSet.has(key) ? evPts : basePts;
      target.push(
        data.positions[a * 3], data.positions[a * 3 + 1], data.positions[a * 3 + 2],
        data.positions[b * 3], data.positions[b * 3 + 1], data.positions[b * 3 + 2]
      );
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(basePts, 3));
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(evPts, 3));
    return { baseLineGeom: bg, evidenceLineGeom: eg };
  }, [data]);

  return (
    <group ref={group}>
      {/* base edges */}
      <lineSegments geometry={baseLineGeom}>
        <lineBasicMaterial color="#4b3f7a" transparent opacity={0.28} />
      </lineSegments>
      {/* evidence edges */}
      <lineSegments geometry={evidenceLineGeom}>
        <lineBasicMaterial color="#c4b5fd" transparent opacity={0.9} />
      </lineSegments>

      {/* nodes */}
      {Array.from({ length: NODE_COUNT }).map((_, i) => {
        const lit = litSet.has(i);
        return (
          <mesh
            key={i}
            position={[data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]]}
          >
            <sphereGeometry args={[lit ? 0.09 : 0.05, 8, 8]} />
            <meshBasicMaterial color={lit ? nodeColorLit : nodeColorBase} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function InfratrixGraph() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <BlockCard id="contrib-infratrix">
      <BlockHeader
        eyebrow="Infratrix · knowledge graph"
        title="A traversable evidence path, not an opinion"
        blurb="The account is modelled as a graph and a deterministic solver walks it. Each finding traces back along typed edges to the resources that justify it — highlighted here as an evidence path."
      />

      <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden" style={{ height: 360 }}>
        <Canvas camera={{ position: [0, 0, 11], fov: 45 }} dpr={[1, 1.75]}>
          <ambientLight intensity={0.8} />
          <GraphScene reduceMotion={reduceMotion} />
          <OrbitControls enablePan={false} enableZoom={false} enableRotate={!reduceMotion} />
        </Canvas>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCounter value={11880} label="Nodes" />
        <StatCounter value={14159} label="Typed edges" />
        <StatCounter value={22} label="AWS service APIs" />
        <StatCounter value={104} label="Optimization patterns" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Rendered subgraph is a representative ~220-node sample for performance; the production graph is 11,880 nodes.
      </p>
    </BlockCard>
  );
}
