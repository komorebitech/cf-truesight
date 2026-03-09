import { Button } from "@/components/ui/button";
import { AreaChart as AreaChartIcon, BarChart3 } from "lucide-react";
import type { ChartType } from "@/lib/analytics-types";

interface ChartTypeSwitcherProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypeSwitcher({ value, onChange }: ChartTypeSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={value === "area" ? "default" : "outline"}
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange("area")}
        title="Area chart"
      >
        <AreaChartIcon className="h-4 w-4" />
      </Button>
      <Button
        variant={value === "bar" ? "default" : "outline"}
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange("bar")}
        title="Bar chart"
      >
        <BarChart3 className="h-4 w-4" />
      </Button>
    </div>
  );
}
