import * as React from "react";
import { subDays, subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange as RDPDateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRange {
  from: Date;
  to: Date;
}

interface Preset {
  value: string;
  label: string;
  range: (() => DateRange) | null;
}

const defaultPresets: Preset[] = [
  { value: "all", label: "All time", range: null },
  {
    value: "today",
    label: "Today",
    range: () => ({ from: new Date(), to: new Date() }),
  },
  {
    value: "7days",
    label: "Last 7 days",
    range: () => ({ from: subDays(new Date(), 7), to: new Date() }),
  },
  {
    value: "30days",
    label: "Last 30 days",
    range: () => ({ from: subDays(new Date(), 30), to: new Date() }),
  },
  {
    value: "90days",
    label: "Last 90 days",
    range: () => ({ from: subDays(new Date(), 90), to: new Date() }),
  },
  {
    value: "thisMonth",
    label: "This month",
    range: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    value: "lastMonth",
    label: "Last month",
    range: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
];

interface DateRangePickerProps {
  value?: DateRange | null;
  onChange: (range: DateRange | null) => void;
  presets?: Preset[];
  showCustom?: boolean;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  numberOfMonths?: number;
}

function DateRangePicker({
  value,
  onChange,
  presets = defaultPresets,
  showCustom = true,
  placeholder = "All time",
  className,
  align = "end",
  numberOfMonths = 2,
}: DateRangePickerProps) {
  const [customDateOpen, setCustomDateOpen] = React.useState(false);
  const [customDateRange, setCustomDateRange] = React.useState<
    RDPDateRange | undefined
  >(undefined);
  const [selectedPreset, setSelectedPreset] = React.useState("all");

  const hasValue = value?.from && value?.to;

  const displayText = hasValue
    ? `${format(value.from, "dd MMM")} - ${format(value.to, "dd MMM")}`
    : placeholder;

  const handlePresetChange = React.useCallback(
    (presetValue: string) => {
      if (presetValue === "custom") {
        setCustomDateRange(
          hasValue ? { from: value.from, to: value.to } : undefined,
        );
        setSelectedPreset("custom");
        setTimeout(() => setCustomDateOpen(true), 0);
        return;
      }

      setSelectedPreset(presetValue);
      const preset = presets.find((p) => p.value === presetValue);
      if (preset) {
        const range =
          typeof preset.range === "function" ? preset.range() : preset.range;
        onChange(range);
      }
    },
    [hasValue, value, presets, onChange],
  );

  const handleCustomApply = React.useCallback(() => {
    if (customDateRange?.from && customDateRange?.to) {
      onChange({ from: customDateRange.from, to: customDateRange.to });
      setCustomDateOpen(false);
      setSelectedPreset("custom");
    }
  }, [customDateRange, onChange]);

  const handleCustomCancel = React.useCallback(() => {
    setCustomDateOpen(false);
    setCustomDateRange(undefined);
  }, []);

  React.useEffect(() => {
    if (!hasValue && selectedPreset !== "all") {
      setSelectedPreset("all");
    }
  }, [hasValue, selectedPreset]);

  if (customDateOpen) {
    return (
      <Popover open={customDateOpen} onOpenChange={setCustomDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 shrink-0 justify-start font-normal",
              className,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">
              {customDateRange?.from && customDateRange?.to
                ? `${format(customDateRange.from, "dd MMM")} - ${format(customDateRange.to, "dd MMM")}`
                : "Select dates"}
            </span>
            <ChevronDown className="ml-auto h-3 w-3 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            mode="range"
            selected={customDateRange}
            onSelect={setCustomDateRange}
            numberOfMonths={numberOfMonths}
          />
          <div className="flex justify-end gap-2 border-t p-3">
            <Button variant="outline" size="sm" onClick={handleCustomCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!customDateRange?.from || !customDateRange?.to}
              onClick={handleCustomApply}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-10 shrink-0 justify-start font-normal",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{displayText}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuRadioGroup
          value={selectedPreset}
          onValueChange={handlePresetChange}
        >
          {presets.map((preset) => (
            <DropdownMenuRadioItem key={preset.value} value={preset.value}>
              {preset.label}
            </DropdownMenuRadioItem>
          ))}
          {showCustom && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="custom">
                Custom range...
              </DropdownMenuRadioItem>
            </>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DateRangePicker, defaultPresets };
export type { DateRange, Preset };
