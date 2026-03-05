import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router";
import { useCohorts, useCreateCohort, useDeleteCohort } from "@/hooks/use-cohorts";
import { usePropertyKeys } from "@/hooks/use-properties";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Header } from "@/components/Header";
import { CohortBuilder } from "@/components/CohortBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Plus, Users, Trash2, Edit, ChevronRight } from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import { motion } from "motion/react";
import type { CohortDefinition } from "@/lib/api";

const DEFAULT_DEFINITION: CohortDefinition = {
  operator: "and",
  rules: [{ type: "event", event_name: "", op: "gte", count: 1, time_window: "30d" }],
};

export function CohortsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cohorts, isLoading } = useCohorts(id);
  const createCohort = useCreateCohort();
  const deleteCohort = useDeleteCohort();
  const { data: propertyData } = usePropertyKeys(id);
  const { environment } = useEnvironment();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteCohortId, setDeleteCohortId] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [definition, setDefinition] = useState<CohortDefinition>(DEFAULT_DEFINITION);
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
      setError("Cohort name is required");
      return;
    }
    if (definition.rules.length === 0) {
      setError("At least one rule is required");
      return;
    }
    setError("");
    await createCohort.mutateAsync({
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

  const deleteCohortName = cohorts?.find((c) => c.id === deleteCohortId)?.name;

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Cohorts" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
              : `${cohorts?.length ?? 0} cohort${(cohorts?.length ?? 0) !== 1 ? "s" : ""}`}
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create Cohort
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !cohorts || cohorts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 font-heading text-lg font-medium">
              No cohorts yet
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Create a cohort to group users by behavior or properties.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Cohort
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Rules</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cohorts.map((cohort) => (
                      <TableRow
                        key={cohort.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate(`/projects/${id}/cohorts/${cohort.id}`)
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cohort.name}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {cohort.description || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {cohort.definition.rules.length}{" "}
                            {cohort.definition.rules.length === 1 ? "rule" : "rules"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateShort(cohort.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/projects/${id}/cohorts/${cohort.id}`,
                                );
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteCohortId(cohort.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Cohort</DialogTitle>
            <DialogDescription>
              Define rules to group users by their behavior or properties.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cohort-name">Name</Label>
              <Input
                id="cohort-name"
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
              <Label htmlFor="cohort-desc">Description (optional)</Label>
              <Textarea
                id="cohort-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this cohort..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Rules</Label>
              <CohortBuilder
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
              <Button type="submit" disabled={createCohort.isPending}>
                {createCohort.isPending ? "Creating..." : "Create Cohort"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteCohortId}
        onOpenChange={(open) => {
          if (!open) setDeleteCohortId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteCohortName}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteCohortId) {
                  deleteCohort.mutate({
                    projectId: id!,
                    cohortId: deleteCohortId,
                  });
                  setDeleteCohortId(null);
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
