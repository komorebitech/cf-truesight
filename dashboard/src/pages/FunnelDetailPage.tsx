import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useFunnel, useFunnelResults, useUpdateFunnel, useDeleteFunnel } from "@/hooks/use-funnels";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { FunnelChart } from "@/components/FunnelChart";
import { FunnelBuilder } from "@/components/FunnelBuilder";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Pencil, Trash2, Clock } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { motion } from "motion/react";

export function FunnelDetailPage() {
  const { id, funnelId } = useParams<{ id: string; funnelId: string }>();
  const navigate = useNavigate();
  const { data: funnel, isLoading: funnelLoading } = useFunnel(id, funnelId);
  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("30d"));
  const { data: results, isLoading: resultsLoading } = useFunnelResults(
    id,
    funnelId,
    timeRange.from,
    timeRange.to,
  );
  const updateFunnel = useUpdateFunnel(id, funnelId);
  const deleteFunnel = useDeleteFunnel(id);
  const { data: breakdownData } = useEventTypeBreakdown(id);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const eventNames = breakdownData?.top_events?.map((e) => e.name) ?? [];

  if (funnelLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="p-6">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Funnel not found.</p>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    deleteFunnel.mutate(funnel.id, {
      onSuccess: () => navigate(`/projects/${id}/funnels`),
    });
    setShowDeleteConfirm(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title={funnel.name} />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {funnel.window_seconds >= 86400
                ? `${Math.round(funnel.window_seconds / 86400)}d`
                : `${Math.round(funnel.window_seconds / 3600)}h`}{" "}
              window
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        </div>

        {/* Overall conversion */}
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-baseline gap-2"
          >
            <span className="text-sm text-muted-foreground">
              Overall conversion:
            </span>
            <span className="text-2xl font-bold">
              {results.overall_conversion.toFixed(1)}%
            </span>
          </motion.div>
        )}

        {/* Funnel chart */}
        <Card>
          <CardHeader>
            <CardTitle>Funnel Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : results ? (
              <FunnelChart steps={results.steps} />
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No results available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step table */}
        {results && results.steps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Step</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                    <TableHead className="text-right">Drop-off</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.steps.map((step, i) => {
                    const prevUsers = i > 0 ? results.steps[i - 1]!.users : step.users;
                    const dropoff =
                      i > 0 && prevUsers > 0
                        ? ((prevUsers - step.users) / prevUsers) * 100
                        : 0;
                    return (
                      <TableRow key={step.step}>
                        <TableCell className="font-bold text-muted-foreground">
                          {step.step}
                        </TableCell>
                        <TableCell className="font-medium">
                          {step.event_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(step.users)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {step.conversion_rate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {i > 0 ? (
                            <span className="text-destructive">
                              -{dropoff.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Funnel</DialogTitle>
            <DialogDescription>
              Modify the funnel steps and settings.
            </DialogDescription>
          </DialogHeader>
          <FunnelBuilder
            initialName={funnel.name}
            initialSteps={Array.isArray(funnel.steps) ? funnel.steps : []}
            initialWindow={funnel.window_seconds}
            eventNames={eventNames}
            onSubmit={async (name, steps, windowSeconds) => {
              await updateFunnel.mutateAsync({
                name,
                steps,
                window_seconds: windowSeconds,
              });
              setShowEdit(false);
            }}
            onCancel={() => setShowEdit(false)}
            isSubmitting={updateFunnel.isPending}
            submitLabel="Update Funnel"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Funnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{funnel.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
