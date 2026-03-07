import { useMemo } from "react";
import type { FlowNode, FlowLink } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/charts";

interface SankeyChartProps {
  nodes: FlowNode[];
  links: FlowLink[];
  isLoading: boolean;
}

interface PositionedNode extends FlowNode {
  x: number;
  y: number;
  height: number;
  color: string;
  value: number;
}

interface PositionedLink extends FlowLink {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  thickness: number;
  color: string;
}

export function SankeyChart({ nodes, links, isLoading }: SankeyChartProps) {
  const layout = useMemo(() => {
    if (nodes.length === 0 || links.length === 0) return null;

    // Group nodes by step
    const stepMap = new Map<number, FlowNode[]>();
    for (const node of nodes) {
      const group = stepMap.get(node.step) ?? [];
      group.push(node);
      stepMap.set(node.step, group);
    }

    const steps = Array.from(stepMap.keys()).sort((a, b) => a - b);
    if (steps.length === 0) return null;

    // Calculate total value for each node
    const nodeValues = new Map<string, number>();
    for (const node of nodes) {
      // Sum of all outgoing links + incoming links (take max)
      const outgoing = links
        .filter((l) => l.source === node.id)
        .reduce((sum, l) => sum + l.value, 0);
      const incoming = links
        .filter((l) => l.target === node.id)
        .reduce((sum, l) => sum + l.value, 0);
      nodeValues.set(node.id, Math.max(outgoing, incoming, 1));
    }

    // Chart dimensions
    const chartWidth = 900;
    const chartHeight = 500;
    const nodeWidth = 20;
    const padding = 60;
    const stepGap =
      steps.length > 1
        ? (chartWidth - 2 * padding - nodeWidth) / (steps.length - 1)
        : 0;
    const nodePadding = 12;

    // Position nodes
    const positioned: PositionedNode[] = [];
    const nodePositions = new Map<
      string,
      { x: number; y: number; height: number }
    >();

    for (let si = 0; si < steps.length; si++) {
      const step = steps[si]!;
      const stepNodes = stepMap.get(step) ?? [];
      const x = padding + si * stepGap;

      // Calculate total value for this step
      const totalValue = stepNodes.reduce(
        (sum, n) => sum + (nodeValues.get(n.id) ?? 1),
        0,
      );
      const availableHeight =
        chartHeight - 2 * padding - (stepNodes.length - 1) * nodePadding;
      const scale = totalValue > 0 ? availableHeight / totalValue : 1;

      let currentY = padding;
      for (let ni = 0; ni < stepNodes.length; ni++) {
        const node = stepNodes[ni]!;
        const value = nodeValues.get(node.id) ?? 1;
        const height = Math.max(value * scale, 4);
        const color = CHART_COLORS[ni % CHART_COLORS.length]!;

        positioned.push({
          ...node,
          x,
          y: currentY,
          height,
          color,
          value,
        });
        nodePositions.set(node.id, { x, y: currentY, height });
        currentY += height + nodePadding;
      }
    }

    // Position links
    // Track cumulative offset for stacking links on each node side
    const sourceOffsets = new Map<string, number>();
    const targetOffsets = new Map<string, number>();

    const posLinks: PositionedLink[] = [];
    // Sort links by value descending for nicer layout
    const sortedLinks = [...links].sort((a, b) => b.value - a.value);

    for (const link of sortedLinks) {
      const src = nodePositions.get(link.source);
      const tgt = nodePositions.get(link.target);
      if (!src || !tgt) continue;

      const srcValue = nodeValues.get(link.source) ?? 1;
      const tgtValue = nodeValues.get(link.target) ?? 1;

      const srcOffset = sourceOffsets.get(link.source) ?? 0;
      const tgtOffset = targetOffsets.get(link.target) ?? 0;

      const thickness = Math.max(
        (link.value / Math.max(srcValue, 1)) * src.height,
        1,
      );

      const sourceX = src.x + nodeWidth;
      const sourceY = src.y + srcOffset + thickness / 2;
      const targetX = tgt.x;
      const targetY = tgt.y + tgtOffset + thickness / 2;

      // Find color from source node
      const srcNode = positioned.find((n) => n.id === link.source);
      const color = srcNode?.color ?? CHART_COLORS[0]!;

      posLinks.push({
        ...link,
        sourceX,
        sourceY,
        targetX,
        targetY,
        thickness,
        color,
      });

      sourceOffsets.set(link.source, srcOffset + thickness);
      targetOffsets.set(
        link.target,
        tgtOffset +
          Math.max(
            (link.value / Math.max(tgtValue, 1)) * tgt.height,
            1,
          ),
      );
    }

    return { nodes: positioned, links: posLinks, chartWidth, chartHeight, steps };
  }, [nodes, links]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!layout || nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No flow data available. Select an anchor event and run the analysis.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Step labels */}
      <div className="mb-2 flex text-xs text-muted-foreground" style={{ width: layout.chartWidth }}>
        {layout.steps.map((step, i) => {
          const padding = 60;
          const nodeWidth = 20;
          const stepGap =
            layout.steps.length > 1
              ? (layout.chartWidth - 2 * padding - nodeWidth) /
                (layout.steps.length - 1)
              : 0;
          const x = padding + i * stepGap;
          return (
            <div
              key={step}
              className="absolute text-center font-medium"
              style={{
                left: x,
                width: nodeWidth + 40,
                marginLeft: -20,
                position: "relative",
              }}
            >
              Step {step}
            </div>
          );
        })}
      </div>

      <svg
        width={layout.chartWidth}
        height={layout.chartHeight}
        className="block"
      >
        {/* Links */}
        {layout.links.map((link, i) => {
          const midX = (link.sourceX + link.targetX) / 2;
          const path = `M ${link.sourceX} ${link.sourceY}
            C ${midX} ${link.sourceY}, ${midX} ${link.targetY}, ${link.targetX} ${link.targetY}`;

          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke={link.color}
                strokeWidth={Math.max(link.thickness, 1)}
                strokeOpacity={0.3}
                className="transition-all hover:stroke-opacity-60"
              />
              {/* Value label on hover region */}
              <title>
                {link.source.split(":").pop()} → {link.target.split(":").pop()}:{" "}
                {formatNumber(link.value)}
              </title>
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={20}
              height={node.height}
              fill={node.color}
              rx={3}
              className="transition-opacity hover:opacity-80"
            />
            {/* Node label */}
            <text
              x={node.x + 24}
              y={node.y + node.height / 2}
              dominantBaseline="central"
              className="fill-foreground text-[11px]"
            >
              {node.name}
            </text>
            {/* Value label */}
            <text
              x={node.x + 24}
              y={node.y + node.height / 2 + 14}
              dominantBaseline="central"
              className="fill-muted-foreground text-[10px]"
            >
              {formatNumber(node.value)}
            </text>
            <title>
              {node.name}: {formatNumber(node.value)}
            </title>
          </g>
        ))}
      </svg>
    </div>
  );
}
