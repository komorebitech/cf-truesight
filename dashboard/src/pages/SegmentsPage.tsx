import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router";
import { useSegments, useCreateSegment, useDeleteSegment } from "@/hooks/use-segments";
import { usePropertyKeys } from "@/hooks/use-properties";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { PageLayout } from "@/components/PageLayout";
import { SegmentBuilder } from "@/components/SegmentBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Plus, Users, Trash2, Zap, SlidersHorizontal } from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import { motion } from "motion/react";
import { fadeInUp } from "@/lib/motion";
import type { SegmentDefinition } from "@/lib/api";

const DEFAULT_DEFINITION: SegmentDefinition = {
  operator: "and",
  rules: [{ type: "event", event_name: "", action: "did", op: "gte", count: 1, time_window: "30d" }],
};

export function SegmentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: segments, isLoading } = useSegments(id);
  const createSegment = useCreateSegment();
  const deleteSegment = useDeleteSegment();
  const { data: propertyData } = usePropertyKeys(id);
  const { environment } = useEnvironment();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteSegmentId, setDeleteSegmentId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [definition, setDefinition] = useState<SegmentDefinition>(DEFAULT_DEFINITION);
  const [error, setError] = useState("");

  const propertyKeys = propertyData?.keys ?? [];

  const resetForm = () => {
    setName("");
    setDescription("");
    setDefinition(DEFAULT_DEFINITION);
    setError("");
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Segment name is required");
      return;
    }
    if (definition.rules.length === 0) {
      setError("At least one rule is required");
      return;
    }
    setError("");
    await createSegment.mutateAsync({
      projectId: id!,
      input: {
        name: trimmedName,
        description: description.trim() || undefined,
        definition,
      },
    });
    setShowCreate(false);
    resetForm();
  };

  const deleteSegmentName = segments?.find((s) => s.id === deleteSegmentId)?.name;

  return (
    <PageLayout title="Segments" spacing={false}>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "\u00A0"
            : `${segments?.length ?? 0} segment${(segments?.length ?? 0) !== 1 ? "s" : ""}`}
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create Segment
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !segments || segments.length === 0 ? (
        <EmptyState
          variant="data"
          icon={Users}
          title="No segments yet"
          description="Create a segment to group users by behavior or properties"
          action={{
            label: "Create Segment",
            onClick: () => setShowCreate(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment, i) => {
            const eventRules = segment.definition.rules.filter((r) => r.type === "event");
            const propertyRules = segment.definition.rules.filter((r) => r.type === "property");

            return (
              <motion.div
                key={segment.id}
                {...fadeInUp}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card
                  className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20"
                  onClick={() => navigate(`/projects/${id}/segments/${segment.id}`)}
                >
                  <CardContent className="px-5 py-4">
                    {/* Header */}
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-heading text-base font-semibold truncate">
                          {segment.name}
                        </h3>
                        {segment.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                            {segment.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {segment.definition.operator.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Rule indicators */}
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      {eventRules.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Zap className="h-3 w-3" />
                          {eventRules.length} event {eventRules.length === 1 ? "rule" : "rules"}
                        </span>
                      )}
                      {propertyRules.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--chart-6)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--chart-6))]">
                          <SlidersHorizontal className="h-3 w-3" />
                          {propertyRules.length} property {propertyRules.length === 1 ? "rule" : "rules"}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDateShort(segment.created_at)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteSegmentId(segment.id);
                        }}
                        className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
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

      {/* Create Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Create Segment</DialogTitle>
                <DialogDescription>
                  Group users by their behavior or properties
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="segment-name">Name</Label>
                <Input
                  id="segment-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="e.g. Power Users"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="segment-desc">
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="segment-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this segment..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rules</Label>
              <SegmentBuilder
                definition={definition}
                onChange={setDefinition}
                projectId={id}
                environment={environment}
                propertyKeys={propertyKeys}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createSegment.isPending}>
                {createSegment.isPending ? "Creating..." : "Create Segment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteSegmentId}
        onOpenChange={(open) => {
          if (!open) setDeleteSegmentId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteSegmentName}&quot;? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteSegmentId) {
                  deleteSegment.mutate({
                    projectId: id!,
                    segmentId: deleteSegmentId,
                  });
                  setDeleteSegmentId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
