import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useFunnels, useCreateFunnel, useDeleteFunnel } from "@/hooks/use-funnels";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { FunnelBuilder } from "@/components/FunnelBuilder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Plus, GitBranch, Clock, ArrowRight, Trash2, BarChart } from "lucide-react";
import { motion } from "motion/react";

export function FunnelsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: funnels, isLoading } = useFunnels(id);
  const createFunnel = useCreateFunnel(id);
  const deleteFunnel = useDeleteFunnel(id);
  const { data: breakdownData } = useEventTypeBreakdown(id);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteFunnelId, setDeleteFunnelId] = useState<string | null>(null);

  const eventNames = breakdownData?.top_events?.map((e) => e.name) ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Funnels" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
              : `${funnels?.length ?? 0} funnel${(funnels?.length ?? 0) !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${id}/funnels/compare`)}
            >
              <BarChart className="h-4 w-4" />
              Compare
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Funnel
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : !funnels || funnels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <GitBranch className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 font-serif text-lg font-medium">
              No funnels yet
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Create a funnel to analyze user conversion flows.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Funnel
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {funnels.map((funnel, i) => {
              const steps = Array.isArray(funnel.steps)
                ? funnel.steps
                : [];
              return (
                <motion.div
                  key={funnel.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() =>
                      navigate(`/projects/${id}/funnels/${funnel.id}`)
                    }
                  >
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <h3 className="font-serif text-base font-semibold">
                          {funnel.name}
                        </h3>
                        <Badge variant="secondary">
                          {steps.length} steps
                        </Badge>
                      </div>

                      <div className="mb-3 flex flex-wrap items-center gap-1">
                        {steps.slice(0, 4).map((step: { event_name: string }, j: number) => (
                          <span key={j} className="flex items-center gap-1">
                            <span className="truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                              {step.event_name}
                            </span>
                            {j < Math.min(steps.length, 4) - 1 && (
                              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )}
                          </span>
                        ))}
                        {steps.length > 4 && (
                          <span className="text-xs text-muted-foreground">
                            +{steps.length - 4} more
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {funnel.window_seconds >= 86400
                            ? `${Math.round(funnel.window_seconds / 86400)}d`
                            : `${Math.round(funnel.window_seconds / 3600)}h`}{" "}
                          window
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteFunnelId(funnel.id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Funnel</DialogTitle>
            <DialogDescription>
              Define the steps in your conversion funnel.
            </DialogDescription>
          </DialogHeader>
          <FunnelBuilder
            eventNames={eventNames}
            onSubmit={async (name, steps, windowSeconds) => {
              await createFunnel.mutateAsync({
                name,
                steps,
                window_seconds: windowSeconds,
              });
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
            isSubmitting={createFunnel.isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteFunnelId}
        onOpenChange={(open) => { if (!open) setDeleteFunnelId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Funnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this funnel? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteFunnelId) {
                  deleteFunnel.mutate(deleteFunnelId);
                  setDeleteFunnelId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
