import { useMemo, useCallback, type CSSProperties } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  Handle,
  MiniMap,
  Controls,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/utils";
import type { FlowNode, FlowLink } from "@/lib/api";
import { Workflow } from "lucide-react";

// ── Theme colors ─────────────────────────────────────────────────────

const STEP_COLORS = [
  { bg: "#2d6a4f",  bgLight: "hsl(153, 40%, 94%)",  border: "hsl(153, 30%, 76%)",  text: "hsl(153, 35%, 20%)" },
  { bg: "#9e2a2b",  bgLight: "hsl(0, 45%, 94%)",    border: "hsl(0, 40%, 78%)",    text: "hsl(0, 45%, 25%)" },
  { bg: "#d62828",  bgLight: "hsl(0, 60%, 94%)",    border: "hsl(0, 55%, 80%)",    text: "hsl(0, 55%, 28%)" },
  { bg: "#386641",  bgLight: "hsl(133, 28%, 93%)",  border: "hsl(133, 22%, 76%)",  text: "hsl(133, 25%, 20%)" },
  { bg: "#ffb700",  bgLight: "hsl(43, 100%, 94%)",  border: "hsl(43, 70%, 78%)",   text: "hsl(43, 70%, 25%)" },
  { bg: "#1565c0",  bgLight: "hsl(211, 65%, 94%)",  border: "hsl(211, 55%, 78%)",  text: "hsl(211, 60%, 22%)" },
];

// ── Layout constants ─────────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_BASE_HEIGHT = 72;
const STEP_GAP_X = 300;
const NODE_GAP_Y = 24;
const PADDING_X = 60;
const PADDING_Y = 40;

// ── Custom node component ────────────────────────────────────────────

interface FlowEventData {
  label: string;
  userCount: number;
  percentage: number;
  stepIndex: number;
  isAnchor: boolean;
  totalInStep: number;
  rankInStep: number;
  [key: string]: unknown;
}

function FlowEventNode({ data }: NodeProps<Node<FlowEventData>>) {
  const colors = STEP_COLORS[data.stepIndex % STEP_COLORS.length]!;
  const barWidth = Math.max(data.percentage, 2);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: data.stepIndex * 0.08 + data.rankInStep * 0.04,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        "--node-accent": colors.bg,
        "--node-bg": colors.bgLight,
        "--node-border": colors.border,
        "--node-text": colors.text,
      } as CSSProperties}
      className="group relative"
    >
      <Handle type="target" position={Position.Left} className="!-left-px !h-3 !w-1.5 !rounded-sm !border-0 !bg-[var(--node-accent)] !opacity-0" />
      <Handle type="source" position={Position.Right} className="!-right-px !h-3 !w-1.5 !rounded-sm !border-0 !bg-[var(--node-accent)] !opacity-0" />

      <div
        className="relative overflow-hidden rounded-xl border-[1.5px] bg-card shadow-sm transition-shadow duration-200 group-hover:shadow-md"
        style={{
          borderColor: data.isAnchor ? colors.bg : colors.border,
          width: NODE_WIDTH,
          minHeight: NODE_BASE_HEIGHT,
        }}
      >
        {/* Accent top bar */}
        {data.isAnchor && (
          <div
            className="h-[3px] w-full"
            style={{ background: `linear-gradient(90deg, ${colors.bg}, ${colors.bg}88)` }}
          />
        )}

        <div className="px-3.5 py-2.5">
          {/* Step badge + event name */}
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-[10px] font-bold text-white"
              style={{ backgroundColor: colors.bg }}
            >
              {data.isAnchor ? "★" : `S${data.stepIndex}`}
            </span>
            <span className="truncate text-[13px] font-semibold leading-snug text-foreground">
              {data.label}
            </span>
          </div>

          {/* Stats row */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {formatNumber(data.userCount)} users
            </span>
            <span
              className="rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
              style={{
                backgroundColor: colors.bgLight,
                color: colors.text,
              }}
            >
              {data.percentage.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/60">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barWidth}%` }}
              transition={{ duration: 0.8, delay: data.stepIndex * 0.1 + 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ backgroundColor: colors.bg }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const nodeTypes = { flowEvent: FlowEventNode };

// ── Layout logic ─────────────────────────────────────────────────────

function buildLayout(
  flowNodes: FlowNode[],
  flowLinks: FlowLink[],
): { nodes: Node<FlowEventData>[]; edges: Edge[] } {
  if (flowNodes.length === 0) return { nodes: [], edges: [] };

  // Group nodes by step
  const stepMap = new Map<number, FlowNode[]>();
  for (const n of flowNodes) {
    const arr = stepMap.get(n.step) ?? [];
    arr.push(n);
    stepMap.set(n.step, arr);
  }

  const steps = Array.from(stepMap.keys()).sort((a, b) => a - b);

  // Calculate value per node (max of incoming/outgoing)
  const nodeValues = new Map<string, number>();
  for (const n of flowNodes) {
    const outgoing = flowLinks.filter((l) => l.source === n.id).reduce((s, l) => s + l.value, 0);
    const incoming = flowLinks.filter((l) => l.target === n.id).reduce((s, l) => s + l.value, 0);
    nodeValues.set(n.id, Math.max(outgoing, incoming, 1));
  }

  // Find max value across all nodes for percentage calc
  const maxValue = Math.max(...Array.from(nodeValues.values()), 1);

  // Sort nodes within each step by value descending
  for (const [step, arr] of stepMap) {
    arr.sort((a, b) => (nodeValues.get(b.id) ?? 0) - (nodeValues.get(a.id) ?? 0));
    stepMap.set(step, arr);
  }

  // Position nodes
  const nodes: Node<FlowEventData>[] = [];
  const isAnchorStep = steps[0] ?? 0;

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si]!;
    const stepNodes = stepMap.get(step) ?? [];
    const x = PADDING_X + si * STEP_GAP_X;

    // Center the column vertically
    const totalHeight = stepNodes.length * NODE_BASE_HEIGHT + (stepNodes.length - 1) * NODE_GAP_Y;
    let startY = PADDING_Y + Math.max(0, (400 - totalHeight) / 2);

    for (let ni = 0; ni < stepNodes.length; ni++) {
      const fn = stepNodes[ni]!;
      const value = nodeValues.get(fn.id) ?? 1;
      const percentage = (value / maxValue) * 100;
      const isAnchor = step === isAnchorStep && ni === 0;

      nodes.push({
        id: fn.id,
        type: "flowEvent",
        position: { x, y: startY },
        data: {
          label: fn.name,
          userCount: value,
          percentage,
          stepIndex: si,
          isAnchor,
          totalInStep: stepNodes.length,
          rankInStep: ni,
        },
      });

      startY += NODE_BASE_HEIGHT + NODE_GAP_Y;
    }
  }

  // Build edges with proportional width
  const maxLinkValue = Math.max(...flowLinks.map((l) => l.value), 1);

  const edges: Edge[] = flowLinks.map((link, i) => {
    const thickness = Math.max(1.5, (link.value / maxLinkValue) * 12);
    const opacity = 0.15 + (link.value / maxLinkValue) * 0.45;

    // Pick color from source node's step
    const srcNode = flowNodes.find((n) => n.id === link.source);
    const srcStep = srcNode?.step ?? 0;
    const stepIdx = steps.indexOf(srcStep);
    const colors = STEP_COLORS[(stepIdx >= 0 ? stepIdx : 0) % STEP_COLORS.length]!;

    return {
      id: `e-${i}`,
      source: link.source,
      target: link.target,
      type: "default",
      animated: link.value / maxLinkValue > 0.3,
      style: {
        stroke: colors.bg,
        strokeWidth: thickness,
        opacity,
      },
      label: formatNumber(link.value),
      labelStyle: {
        fontSize: 10,
        fontWeight: 600,
        fill: "hsl(var(--muted-foreground))",
        fontFamily: "var(--font-sans)",
      },
      labelBgStyle: {
        fill: "hsl(var(--card))",
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    };
  });

  return { nodes, edges };
}

// ── Inner component (needs ReactFlowProvider) ─────────────────────────

interface FlowDiagramInnerProps {
  flowNodes: FlowNode[];
  flowLinks: FlowLink[];
}

function FlowDiagramInner({ flowNodes, flowLinks }: FlowDiagramInnerProps) {
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(
    () => buildLayout(flowNodes, flowLinks),
    [flowNodes, flowLinks],
  );

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.15, duration: 600 }), 100);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={onInit}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.3}
      maxZoom={1.5}
      defaultEdgeOptions={{
        type: "default",
      }}
      proOptions={{ hideAttribution: true }}
      className="rounded-lg bg-muted/20"
    >
      <Controls
        position="bottom-right"
        className="!rounded-lg !border !border-border !bg-card !shadow-sm [&>button]:!rounded-md [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground [&>button:hover]:!bg-muted"
      />
      <MiniMap
        position="bottom-left"
        pannable
        zoomable
        className="!rounded-lg !border !border-border !bg-card/80 !shadow-sm"
        maskColor="hsl(var(--muted) / 0.5)"
        nodeColor={(n) => {
          const d = n.data as FlowEventData | undefined;
          const idx = d?.stepIndex ?? 0;
          return STEP_COLORS[idx % STEP_COLORS.length]!.bg;
        }}
      />
    </ReactFlow>
  );
}

// ── Public component ─────────────────────────────────────────────────

interface FlowDiagramProps {
  nodes: FlowNode[];
  links: FlowLink[];
  isLoading: boolean;
}

export function FlowDiagram({ nodes, links, isLoading }: FlowDiagramProps) {
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] min-h-[560px] flex-col items-center justify-center gap-4 rounded-lg bg-muted/20">
        <div className="flex gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-[72px] w-[220px] rounded-xl" />
              {i < 3 && <Skeleton className="h-[72px] w-[220px] rounded-xl" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Loading flow data...</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="h-[calc(100vh-12rem)] min-h-[560px] rounded-lg bg-muted/20">
        <EmptyState
          variant="data"
          icon={Workflow}
          title="No flow data"
          description="No transitions found. Try a different anchor event, wider time range, or check that users are performing events after the anchor."
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] min-h-[560px] w-full">
      <ReactFlowProvider>
        <FlowDiagramInner flowNodes={nodes} flowLinks={links} />
      </ReactFlowProvider>
    </div>
  );
}
