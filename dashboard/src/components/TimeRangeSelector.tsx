import { useState } from "react";
import { subDays, subMonths, formatISO, startOfDay } from "date-fns";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "motion/react";

export interface TimeRange {
  from: string;
  to: string;
}

type Preset = "7d" | "30d" | "90d" | "custom";

function getPresetRange(preset: Preset): TimeRange {
  const now = new Date();
  const to = formatISO(now);
  switch (preset) {
    case "7d":
      return { from: formatISO(startOfDay(subDays(now, 7))), to };
    case "30d":
      return { from: formatISO(startOfDay(subDays(now, 30))), to };
    case "90d":
      return { from: formatISO(startOfDay(subMonths(now, 3))), to };
    default:
      return { from: formatISO(startOfDay(subDays(now, 7))), to };
  }
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const [activePreset, setActivePreset] = useState<Preset>("7d");

  const handlePreset = (preset: string) => {
    const p = preset as Preset;
    setActivePreset(p);
    if (p !== "custom") {
      onChange(getPresetRange(p));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs value={activePreset} onValueChange={handlePreset}>
        <TabsList>
          <TabsTrigger value="7d">7d</TabsTrigger>
          <TabsTrigger value="30d">30d</TabsTrigger>
          <TabsTrigger value="90d">90d</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>

      {activePreset === "custom" && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          className="flex items-center gap-2 overflow-hidden"
        >
          <Input
            type="date"
            value={value.from.slice(0, 10)}
            onChange={(e) =>
              onChange({
                ...value,
                from: new Date(e.target.value).toISOString(),
              })
            }
            className="w-36"
          />
          <span className="text-sm text-muted-foreground">
            to
          </span>
          <Input
            type="date"
            value={value.to.slice(0, 10)}
            onChange={(e) =>
              onChange({
                ...value,
                to: new Date(e.target.value).toISOString(),
              })
            }
            className="w-36"
          />
        </motion.div>
      )}
    </div>
  );
}

export { getPresetRange };
