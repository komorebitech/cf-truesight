import { useState } from "react";
import { useParams } from "react-router";
import { useFunnels, useCompareFunnels, useCompareFunnelTimeRanges } from "@/hooks/use-funnels";
import { Header } from "@/components/Header";
import { FunnelChart } from "@/components/FunnelChart";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

type CompareMode = "funnels" | "time-ranges";

export function FunnelComparePage() {
  const { id } = useParams<{ id: string }>();
  const { data: funnels } = useFunnels(id);

  const [mode, setMode] = useState<CompareMode>("funnels");
  const [funnelA, setFunnelA] = useState("");
  const [funnelB, setFunnelB] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("30d"));

  // Time range comparison state
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [rangeA, setRangeA] = useState<TimeRange>(getPresetRange("30d"));
  const [rangeB, setRangeB] = useState<TimeRange>(getPresetRange("7d"));

  const funnelIds = funnelA && funnelB ? [funnelA, funnelB] : [];
  const { data: compareData, isLoading: compareLoading } = useCompareFunnels(
    mode === "funnels" ? id : undefined,
    funnelIds,
    timeRange.from,
    timeRange.to,
  );

  const { data: timeCompareData, isLoading: timeCompareLoading } =
    useCompareFunnelTimeRanges(
      mode === "time-ranges" ? id : undefined,
      selectedFunnelId || undefined,
      rangeA.from,
      rangeA.to,
      rangeB.from,
      rangeB.to,
    );

  const data = mode === "funnels" ? compareData : timeCompareData;
  const loading = mode === "funnels" ? compareLoading : timeCompareLoading;

  const resultA = data?.funnels?.[0];
  const resultB = data?.funnels?.[1];

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Compare Funnels" />

      <div className="flex-1 space-y-6 p-6">
        {/* Mode selector */}
        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as CompareMode)}>
            <TabsList>
              <TabsTrigger value="funnels">Compare Funnels</TabsTrigger>
              <TabsTrigger value="time-ranges">Compare Time Ranges</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Funnel comparison controls */}
        {mode === "funnels" && (
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Funnel A
              </label>
              <Select value={funnelA} onChange={(e) => setFunnelA(e.target.value)}>
                <option value="">Select funnel...</option>
                {funnels?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Funnel B
              </label>
              <Select value={funnelB} onChange={(e) => setFunnelB(e.target.value)}>
                <option value="">Select funnel...</option>
                {funnels?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        )}

        {/* Time range comparison controls */}
        {mode === "time-ranges" && (
          <div className="space-y-4">
            <div className="min-w-[200px] max-w-xs">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Funnel
              </label>
              <Select
                value={selectedFunnelId}
                onChange={(e) => setSelectedFunnelId(e.target.value)}
              >
                <option value="">Select funnel...</option>
                {funnels?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Period A
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={rangeA.from.slice(0, 10)}
                    onChange={(e) =>
                      setRangeA({ ...rangeA, from: new Date(e.target.value).toISOString() })
                    }
                    className="w-36"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={rangeA.to.slice(0, 10)}
                    onChange={(e) =>
                      setRangeA({ ...rangeA, to: new Date(e.target.value).toISOString() })
                    }
                    className="w-36"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Period B
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={rangeB.from.slice(0, 10)}
                    onChange={(e) =>
                      setRangeB({ ...rangeB, from: new Date(e.target.value).toISOString() })
                    }
                    className="w-36"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={rangeB.to.slice(0, 10)}
                    onChange={(e) =>
                      setRangeB({ ...rangeB, to: new Date(e.target.value).toISOString() })
                    }
                    className="w-36"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : resultA && resultB ? (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {mode === "funnels"
                        ? funnels?.find((f) => f.id === funnelA)?.name ?? "Funnel A"
                        : "Period A"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 text-sm text-muted-foreground">
                      Overall: {resultA.overall_conversion.toFixed(1)}%
                    </div>
                    <FunnelChart steps={resultA.steps} />
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {mode === "funnels"
                        ? funnels?.find((f) => f.id === funnelB)?.name ?? "Funnel B"
                        : "Period B"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 text-sm text-muted-foreground">
                      Overall: {resultB.overall_conversion.toFixed(1)}%
                    </div>
                    <FunnelChart steps={resultB.steps} />
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Delta comparison table */}
            <Card>
              <CardHeader>
                <CardTitle>Step Comparison</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead className="text-right">A</TableHead>
                      <TableHead className="text-right">B</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultA.steps.map((stepA, i) => {
                      const stepB = resultB.steps[i];
                      const delta = stepB
                        ? stepB.conversion_rate - stepA.conversion_rate
                        : 0;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {stepA.event_name}
                          </TableCell>
                          <TableCell className="text-right">
                            {stepA.conversion_rate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {stepB?.conversion_rate.toFixed(1) ?? "-"}%
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 font-medium",
                                delta > 0
                                  ? "text-success"
                                  : delta < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                              )}
                            >
                              {delta > 0 ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : delta < 0 ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : (
                                <Minus className="h-3 w-3" />
                              )}
                              {Math.abs(delta).toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {mode === "funnels"
              ? "Select two funnels and a time range to compare"
              : "Select a funnel and two time periods to compare"}
          </div>
        )}
      </div>
    </div>
  );
}
