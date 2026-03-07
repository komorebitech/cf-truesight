export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function resolvePreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const ms = preset === "30d" ? 30 * 86400000 : preset === "14d" ? 14 * 86400000 : 7 * 86400000;
  const from = new Date(now.getTime() - ms).toISOString();
  return { from, to };
}

export const AXIS_DEFAULTS = {
  tick: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
  tickLine: false,
  axisLine: false,
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "13px",
    color: "hsl(var(--popover-foreground))",
  },
} as const;
