import { useState, useMemo } from "react";
import {
  subDays,
  subWeeks,
  subMonths,
  formatISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  format,
} from "date-fns";
import { CalendarIcon, ArrowRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export interface TimeRange {
  from: string;
  to: string;
}

export type Preset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "3m"
  | "6m"
  | "12m"
  | "90d"
  | "custom";

export function getPresetRange(preset: Preset | string): TimeRange {
  const now = new Date();
  const to = formatISO(now);
  switch (preset) {
    case "today":
      return { from: formatISO(startOfDay(now)), to };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return {
        from: formatISO(startOfDay(yesterday)),
        to: formatISO(endOfDay(yesterday)),
      };
    }
    case "7d":
      return { from: formatISO(startOfDay(subDays(now, 7))), to };
    case "30d":
      return { from: formatISO(startOfDay(subDays(now, 30))), to };
    case "3m":
    case "90d":
      return { from: formatISO(startOfDay(subMonths(now, 3))), to };
    case "6m":
      return { from: formatISO(startOfDay(subMonths(now, 6))), to };
    case "12m":
      return { from: formatISO(startOfDay(subMonths(now, 12))), to };
    default:
      return { from: formatISO(startOfDay(subDays(now, 7))), to };
  }
}

/* ── Internal types ── */

type CustomMode = "fixed" | "last" | "since" | "period";
type PeriodUnit = "days" | "weeks" | "months";
type PeriodToDateOption = "day" | "week" | "month" | "quarter" | "year";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
];

const SIDEBAR_MODES: { value: CustomMode; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "last", label: "Last" },
  { value: "since", label: "Since" },
  { value: "period", label: "Period to date" },
];

function detectPreset(value: TimeRange): Preset {
  const now = Date.now();
  const from = new Date(value.from).getTime();
  const diffDays = Math.round((now - from) / 86_400_000);
  if (diffDays <= 1) return "today";
  if (diffDays >= 6 && diffDays <= 8) return "7d";
  if (diffDays >= 29 && diffDays <= 31) return "30d";
  if (diffDays >= 88 && diffDays <= 93) return "3m";
  if (diffDays >= 178 && diffDays <= 184) return "6m";
  if (diffDays >= 363 && diffDays <= 367) return "12m";
  return "custom";
}

/* ── Main component ── */

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({
  value,
  onChange,
}: TimeRangeSelectorProps) {
  const [activePreset, setActivePreset] = useState<Preset>(() =>
    detectPreset(value),
  );
  const [customOpen, setCustomOpen] = useState(false);

  // Custom picker internal state
  const [customMode, setCustomMode] = useState<CustomMode>("fixed");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [lastN, setLastN] = useState(7);
  const [lastUnit, setLastUnit] = useState<PeriodUnit>("days");
  const [sinceDate, setSinceDate] = useState<Date | undefined>();
  const [periodToDate, setPeriodToDate] =
    useState<PeriodToDateOption>("month");

  // When popover is open, visually highlight "Custom"; otherwise show the committed preset
  const visualPreset = customOpen ? "custom" : activePreset;

  const handlePresetClick = (preset: Preset) => {
    setActivePreset(preset);
    setCustomOpen(false);
    onChange(getPresetRange(preset));
  };

  const handleCustomOpen = (open: boolean) => {
    if (open) {
      setDateRange({ from: new Date(value.from), to: new Date(value.to) });
      setSinceDate(new Date(value.from));
    }
    setCustomOpen(open);
  };

  const handleApply = () => {
    const now = new Date();
    const to = formatISO(now);
    let range: TimeRange;

    switch (customMode) {
      case "fixed":
        if (!dateRange?.from) return;
        range = {
          from: formatISO(startOfDay(dateRange.from)),
          to: dateRange.to
            ? formatISO(endOfDay(dateRange.to))
            : formatISO(endOfDay(dateRange.from)),
        };
        break;
      case "last":
        switch (lastUnit) {
          case "days":
            range = { from: formatISO(startOfDay(subDays(now, lastN))), to };
            break;
          case "weeks":
            range = { from: formatISO(startOfDay(subWeeks(now, lastN))), to };
            break;
          case "months":
            range = {
              from: formatISO(startOfDay(subMonths(now, lastN))),
              to,
            };
            break;
          default:
            return;
        }
        break;
      case "since":
        if (!sinceDate) return;
        range = { from: formatISO(startOfDay(sinceDate)), to };
        break;
      case "period":
        switch (periodToDate) {
          case "day":
            range = { from: formatISO(startOfDay(now)), to };
            break;
          case "week":
            range = {
              from: formatISO(startOfWeek(now, { weekStartsOn: 1 })),
              to,
            };
            break;
          case "month":
            range = { from: formatISO(startOfMonth(now)), to };
            break;
          case "quarter":
            range = { from: formatISO(startOfQuarter(now)), to };
            break;
          case "year":
            range = { from: formatISO(startOfYear(now)), to };
            break;
          default:
            return;
        }
        break;
      default:
        return;
    }

    onChange(range);
    setActivePreset("custom");
    setCustomOpen(false);
  };

  const customLabel = useMemo(() => {
    if (activePreset === "custom" && !customOpen) {
      try {
        const from = new Date(value.from);
        const to = new Date(value.to);
        return `${format(from, "d MMM")} \u2013 ${format(to, "d MMM")}`;
      } catch {
        return "Custom";
      }
    }
    return "Custom";
  }, [activePreset, customOpen, value]);

  return (
    <div className="flex items-center">
      <div className="inline-flex h-9 items-center rounded-lg border bg-muted overflow-hidden">
        {/* Custom button + popover */}
        <Popover open={customOpen} onOpenChange={handleCustomOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-r",
                visualPreset === "custom"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {customLabel}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-auto p-0"
          >
            <div className="flex">
              {/* Sidebar */}
              <div className="w-36 border-r py-3 flex flex-col gap-0.5">
                {SIDEBAR_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setCustomMode(mode.value)}
                    className={cn(
                      "text-left px-4 py-2 text-sm transition-colors",
                      customMode === mode.value
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Main content */}
              <div className="p-4 min-w-0">
                {customMode === "fixed" && (
                  <FixedRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                  />
                )}
                {customMode === "last" && (
                  <LastNPicker
                    n={lastN}
                    unit={lastUnit}
                    onNChange={setLastN}
                    onUnitChange={setLastUnit}
                  />
                )}
                {customMode === "since" && (
                  <SincePicker
                    date={sinceDate}
                    onDateChange={setSinceDate}
                  />
                )}
                {customMode === "period" && (
                  <PeriodToDatePicker
                    selected={periodToDate}
                    onSelect={setPeriodToDate}
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Preset buttons */}
        {PRESETS.map((preset, i) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetClick(preset.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              i !== PRESETS.length - 1 && "border-r",
              visualPreset === preset.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Fixed range picker ── */

function FixedRangePicker({
  dateRange,
  onDateRangeChange,
}: {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Date display row */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Starts
          </span>
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm min-w-[160px]">
            {dateRange?.from ? (
              format(dateRange.from, "d MMM yyyy")
            ) : (
              <span className="text-muted-foreground">Date</span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground mb-2.5 shrink-0" />
        <div className="flex-1">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Ends
          </span>
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm min-w-[160px]">
            {dateRange?.to ? (
              format(dateRange.to, "d MMM yyyy")
            ) : (
              <span className="text-muted-foreground">Date</span>
            )}
          </div>
        </div>
      </div>

      {/* Dual calendar */}
      <Calendar
        mode="range"
        selected={dateRange}
        onSelect={onDateRangeChange}
        numberOfMonths={2}
        weekStartsOn={1}
        disabled={{ after: new Date() }}
        captionLayout="dropdown"
      />
    </div>
  );
}

/* ── Last N picker ── */

function LastNPicker({
  n,
  unit,
  onNChange,
  onUnitChange,
}: {
  n: number;
  unit: PeriodUnit;
  onNChange: (n: number) => void;
  onUnitChange: (unit: PeriodUnit) => void;
}) {
  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Last</span>
        <input
          type="number"
          min={1}
          value={n}
          onChange={(e) =>
            onNChange(Math.max(1, parseInt(e.target.value) || 1))
          }
          className="w-20 rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="inline-flex rounded-md border overflow-hidden">
          {(["days", "weeks", "months"] as PeriodUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onUnitChange(u)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0",
                unit === u
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Shows data from the last {n} {unit}
      </p>
    </div>
  );
}

/* ── Since picker ── */

function SincePicker({
  date,
  onDateChange,
}: {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Since
        </span>
        <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm inline-block min-w-[160px]">
          {date ? (
            format(date, "d MMM yyyy")
          ) : (
            <span className="text-muted-foreground">Date</span>
          )}
        </div>
      </div>
      <Calendar
        mode="single"
        selected={date}
        onSelect={onDateChange}
        weekStartsOn={1}
        disabled={{ after: new Date() }}
        captionLayout="dropdown"
      />
    </div>
  );
}

/* ── Period to date picker ── */

function PeriodToDatePicker({
  selected,
  onSelect,
}: {
  selected: PeriodToDateOption;
  onSelect: (option: PeriodToDateOption) => void;
}) {
  const options: {
    value: PeriodToDateOption;
    label: string;
    description: string;
  }[] = [
    { value: "day", label: "Day", description: "From start of today" },
    {
      value: "week",
      label: "Week",
      description: "From start of this week",
    },
    {
      value: "month",
      label: "Month",
      description: "From start of this month",
    },
    {
      value: "quarter",
      label: "Quarter",
      description: "From start of this quarter",
    },
    {
      value: "year",
      label: "Year",
      description: "From start of this year",
    },
  ];

  return (
    <div className="flex flex-col gap-1 py-2 min-w-[240px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            "text-left rounded-md px-3 py-2.5 transition-colors",
            selected === option.value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <div className="text-sm font-medium">{option.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {option.description}
          </div>
        </button>
      ))}
    </div>
  );
}
