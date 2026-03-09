import { AreaChart as AreaChartIcon, BarChart3 } from "lucide-react";
import type { ChartType } from "@/lib/analytics-types";

interface ChartTypeSwitcherProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypeSwitcher({ value, onChange }: ChartTypeSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-1">
      <button
        type="button"
        onClick={() => onChange("area")}
        title="Area chart"
        className={`inline-flex items-center justify-center rounded-md p-1.5 transition-all ${
          value === "area"
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <AreaChartIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("bar")}
        title="Bar chart"
        className={`inline-flex items-center justify-center rounded-md p-1.5 transition-all ${
          value === "bar"
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <BarChart3 className="h-4 w-4" />
      </button>
    </div>
  );
}
