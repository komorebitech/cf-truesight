import { useState } from "react";
import { useParams } from "react-router";
import { useFunnels, useCompareFunnels, useCompareFunnelTimeRanges } from "@/hooks/use-funnels";
import { PageLayout } from "@/components/PageLayout";
import { ControlDivider } from "@/components/ControlDivider";
import { FunnelChart } from "@/components/FunnelChart";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const { environment } = useEnvironment();

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
    environment,
  );

  const { data: timeCompareData, isLoading: timeCompareLoading } =
    useCompareFunnelTimeRanges(
      mode === "time-ranges" ? id : undefined,
      selectedFunnelId || undefined,
      rangeA.from,
      rangeA.to,
      rangeB.from,
      rangeB.to,
      environment,
    );

  const data = mode === "funnels" ? compareData : timeCompareData;
  const loading = mode === "funnels" ? compareLoading : timeCompareLoading;

  const resultA = data?.funnels?.[0];
  const resultB = data?.funnels?.[1];

  return (
    <PageLayout title="Compare Funnels">
        {/* Controls */}
        {mode === "funnels" && (
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as CompareMode)}>
              <TabsList>
                <TabsTrigger value="funnels">Compare Funnels</TabsTrigger>
                <TabsTrigger value="time-ranges">Compare Time Ranges</TabsTrigger>
              </TabsList>
            </Tabs>

            <ControlDivider />

            <Select value={funnelA || undefined} onValueChange={setFunnelA}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Funnel A..." />
              </SelectTrigger>
              <SelectContent>
                {funnels?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={funnelB || undefined} onValueChange={setFunnelB}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Funnel B..." />
              </SelectTrigger>
              <SelectContent>
                {funnels?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ControlDivider />

            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        )}

        {/* Time range comparison controls */}
        {mode === "time-ranges" && (
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as CompareMode)}>
              <TabsList>
                <TabsTrigger value="funnels">Compare Funnels</TabsTrigger>
                <TabsTrigger value="time-ranges">Compare Time Ranges</TabsTrigger>
              </TabsList>
            </Tabs>

            <ControlDivider />

            <Select value={selectedFunnelId || undefined} onValueChange={setSelectedFunnelId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select funnel..." />
              </SelectTrigger>
              <SelectContent>
                {funnels?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ControlDivider />

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">A:</span>
              <Input
                type="date"
                value={rangeA.from.slice(0, 10)}
                onChange={(e) =>
                  setRangeA({ ...rangeA, from: new Date(e.target.value).toISOString() })
                }
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                value={rangeA.to.slice(0, 10)}
                onChange={(e) =>
                  setRangeA({ ...rangeA, to: new Date(e.target.value).toISOString() })
                }
                className="w-32"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">B:</span>
              <Input
                type="date"
                value={rangeB.from.slice(0, 10)}
                onChange={(e) =>
                  setRangeB({ ...rangeB, from: new Date(e.target.value).toISOString() })
                }
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                value={rangeB.to.slice(0, 10)}
                onChange={(e) =>
                  setRangeB({ ...rangeB, to: new Date(e.target.value).toISOString() })
                }
                className="w-32"
              />
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
    </PageLayout>
  );
}
