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

// ── Layout constants (top-to-bottom tree) ────────────────────────────

const NODE_WIDTH = 240;
const NODE_HEIGHT = 76;
const ROW_GAP_Y = 160;
const NODE_GAP_X = 48;
const PADDING_TOP = 60;

// ── Custom node component ────────────────────────────────────────────

interface FlowEventData {
  label: string;
  userCount: number;
  percentage: number;
  stepIndex: number;
  isAnchor: boolean;
  isClickable: boolean;
  totalInStep: number;
  rankInStep: number;
  [key: string]: unknown;
}

function FlowEventNode({ data }: NodeProps<Node<FlowEventData>>) {
  const colors = STEP_COLORS[data.stepIndex % STEP_COLORS.length]!;
  const barWidth = Math.max(data.percentage, 2);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: data.stepIndex * 0.1 + data.rankInStep * 0.03,
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
      <Handle
        type="target"
        position={Position.Top}
        className="!-top-px !h-1.5 !w-4 !rounded-sm !border-0 !bg-[var(--node-accent)] !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!-bottom-px !h-1.5 !w-4 !rounded-sm !border-0 !bg-[var(--node-accent)] !opacity-0"
      />

      <div
        className={`relative overflow-hidden rounded-xl border-[1.5px] bg-card shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:scale-[1.02] ${data.isClickable && !data.isAnchor ? "cursor-pointer ring-0 group-hover:ring-2 group-hover:ring-[var(--node-accent)]/30" : ""}`}
        style={{
          borderColor: data.isAnchor ? colors.bg : colors.border,
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-[3px] w-full"
          style={{
            background: data.isAnchor
              ? `linear-gradient(90deg, ${colors.bg}, ${colors.bg}cc)`
              : `linear-gradient(90deg, ${colors.bg}44, ${colors.bg}22)`,
          }}
        />

        <div className="px-4 py-2.5">
          {/* Step badge + event name */}
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-lg px-1.5 text-[11px] font-bold text-white shadow-sm"
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
              className="rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums"
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

// ── Tree layout logic (top-to-bottom) ────────────────────────────────

function buildLayout(
  flowNodes: FlowNode[],
  flowLinks: FlowLink[],
  isClickable: boolean,
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

  const maxValue = Math.max(...Array.from(nodeValues.values()), 1);

  // Sort nodes within each step by value descending
  for (const [, arr] of stepMap) {
    arr.sort((a, b) => (nodeValues.get(b.id) ?? 0) - (nodeValues.get(a.id) ?? 0));
  }

  // Position nodes
  const nodePositions = new Map<string, { x: number; y: number }>();
  const nodes: Node<FlowEventData>[] = [];
  const isAnchorStep = steps[0] ?? 0;

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si]!;
    const stepNodes = stepMap.get(step) ?? [];
    const y = PADDING_TOP + si * ROW_GAP_Y;
    const rowWidth = stepNodes.length * NODE_WIDTH + (stepNodes.length - 1) * NODE_GAP_X;

    if (si === 0) {
      const startX = -rowWidth / 2;
      for (let ni = 0; ni < stepNodes.length; ni++) {
        const fn = stepNodes[ni]!;
        const x = startX + ni * (NODE_WIDTH + NODE_GAP_X);
        nodePositions.set(fn.id, { x, y });
      }
    } else {
      const parentXMap = new Map<string, number[]>();
      for (const fn of stepNodes) {
        const parentLinks = flowLinks.filter((l) => l.target === fn.id);
        const parentXs: number[] = [];
        for (const pl of parentLinks) {
          const pp = nodePositions.get(pl.source);
          if (pp) parentXs.push(pp.x + NODE_WIDTH / 2);
        }
        parentXMap.set(fn.id, parentXs);
      }

      stepNodes.sort((a, b) => {
        const aParents = parentXMap.get(a.id) ?? [0];
        const bParents = parentXMap.get(b.id) ?? [0];
        const aCenterParent = aParents.reduce((s, v) => s + v, 0) / aParents.length;
        const bCenterParent = bParents.reduce((s, v) => s + v, 0) / bParents.length;
        return aCenterParent - bCenterParent;
      });

      const allParentXs: number[] = [];
      for (const fn of stepNodes) {
        const pxs = parentXMap.get(fn.id) ?? [];
        allParentXs.push(...pxs);
      }
      const rowCenter = allParentXs.length > 0
        ? allParentXs.reduce((s, v) => s + v, 0) / allParentXs.length
        : 0;

      const startX = rowCenter - rowWidth / 2;
      for (let ni = 0; ni < stepNodes.length; ni++) {
        const fn = stepNodes[ni]!;
        const x = startX + ni * (NODE_WIDTH + NODE_GAP_X);
        nodePositions.set(fn.id, { x, y });
      }
    }
  }

  // Build React Flow nodes
  for (let si = 0; si < steps.length; si++) {
    const step = steps[si]!;
    const stepNodes = stepMap.get(step) ?? [];

    for (let ni = 0; ni < stepNodes.length; ni++) {
      const fn = stepNodes[ni]!;
      const value = nodeValues.get(fn.id) ?? 1;
      const percentage = (value / maxValue) * 100;
      const isAnchor = step === isAnchorStep && stepNodes.length === 1;
      const pos = nodePositions.get(fn.id) ?? { x: 0, y: 0 };

      nodes.push({
        id: fn.id,
        type: "flowEvent",
        position: pos,
        data: {
          label: fn.name,
          userCount: value,
          percentage,
          stepIndex: si,
          isAnchor,
          isClickable,
          totalInStep: stepNodes.length,
          rankInStep: ni,
        },
      });
    }
  }

  // Build edges
  const maxLinkValue = Math.max(...flowLinks.map((l) => l.value), 1);

  const edges: Edge[] = flowLinks.map((link, i) => {
    const ratio = link.value / maxLinkValue;
    const thickness = Math.max(1.5, ratio * 10);
    const opacity = 0.2 + ratio * 0.55;

    const srcNode = flowNodes.find((n) => n.id === link.source);
    const srcStep = srcNode?.step ?? 0;
    const stepIdx = steps.indexOf(srcStep);
    const colors = STEP_COLORS[(stepIdx >= 0 ? stepIdx : 0) % STEP_COLORS.length]!;

    return {
      id: `e-${i}`,
      source: link.source,
      target: link.target,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: colors.bg,
        strokeWidth: thickness,
        opacity,
      },
      label: `${formatNumber(link.value)}`,
      labelStyle: {
        fontSize: 10,
        fontWeight: 600,
        fill: "hsl(var(--muted-foreground))",
        fontFamily: "var(--font-sans)",
      },
      labelBgStyle: {
        fill: "hsl(var(--card))",
        fillOpacity: 0.95,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 6,
    };
  });

  return { nodes, edges };
}

// ── Inner component (needs ReactFlowProvider) ─────────────────────────

interface FlowDiagramInnerProps {
  flowNodes: FlowNode[];
  flowLinks: FlowLink[];
  /** Whether clicking non-anchor nodes triggers onNodeClick */
  isClickable: boolean;
  onNodeClick?: (eventName: string) => void;
}

function FlowDiagramInner({ flowNodes, flowLinks, isClickable, onNodeClick }: FlowDiagramInnerProps) {
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(
    () => buildLayout(flowNodes, flowLinks, isClickable),
    [flowNodes, flowLinks, isClickable],
  );

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 100);
  }, [fitView]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<FlowEventData>) => {
      if (!isClickable || !onNodeClick) return;
      if (node.data.isAnchor) return;
      onNodeClick(node.data.label);
    },
    [isClickable, onNodeClick],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={onInit}
      onNodeClick={handleNodeClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.15}
      maxZoom={1.5}
      defaultEdgeOptions={{
        type: "smoothstep",
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
  /** Whether clicking non-anchor nodes triggers onNodeClick */
  isClickable?: boolean;
  onNodeClick?: (eventName: string) => void;
}

export function FlowDiagram({ nodes, links, isLoading, isClickable = false, onNodeClick }: FlowDiagramProps) {
  if (isLoading) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg bg-muted/20">
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-[72px] w-[240px] rounded-xl" />
          <div className="flex gap-6">
            <Skeleton className="h-[72px] w-[240px] rounded-xl" />
            <Skeleton className="h-[72px] w-[240px] rounded-xl" />
            <Skeleton className="h-[72px] w-[240px] rounded-xl" />
          </div>
          <div className="flex gap-6">
            <Skeleton className="h-[72px] w-[240px] rounded-xl" />
            <Skeleton className="h-[72px] w-[240px] rounded-xl" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Loading flow data...</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg bg-muted/20">
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
    <div className="h-full w-full">
      <ReactFlowProvider>
        <FlowDiagramInner
          flowNodes={nodes}
          flowLinks={links}
          isClickable={isClickable}
          onNodeClick={onNodeClick}
        />
      </ReactFlowProvider>
    </div>
  );
}
