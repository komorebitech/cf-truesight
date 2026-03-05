import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router";
import {
  useCohort,
  useUpdateCohort,
  useDeleteCohort,
  useCohortSize,
  useCohortUsers,
} from "@/hooks/use-cohorts";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import { usePropertyKeys } from "@/hooks/use-properties";
import { Header } from "@/components/Header";
import { CohortBuilder } from "@/components/CohortBuilder";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { ChevronLeft, Edit, Trash2, Users } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { motion } from "motion/react";
import type { CohortDefinition } from "@/lib/api";

const EVENT_OP_LABELS: Record<string, string> = {
  gte: "at least",
  lte: "at most",
  eq: "exactly",
};

const PROPERTY_OP_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "not equals",
  contains: "contains",
  exists: "exists",
};

export function CohortDetailPage() {
  const { id, cohortId } = useParams<{ id: string; cohortId: string }>();
  const navigate = useNavigate();
  const { data: cohort, isLoading: cohortLoading } = useCohort(id, cohortId);

  const { environment } = useEnvironment();

  const [page, setPage] = useState(1);
  const perPage = 25;

  const { data: sizeData, isLoading: sizeLoading } = useCohortSize(
    id,
    cohortId,
    environment,
  );
  const { data: usersData, isLoading: usersLoading } = useCohortUsers(
    id,
    cohortId,
    { page, per_page: perPage, environment },
  );

  const updateCohort = useUpdateCohort();
  const deleteCohort = useDeleteCohort();
  const { data: breakdownData } = useEventTypeBreakdown(id);
  const { data: propertyData } = usePropertyKeys(id);

  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDefinition, setEditDefinition] = useState<CohortDefinition>({
    operator: "and",
    rules: [],
  });
  const [editError, setEditError] = useState("");

  const eventNames = breakdownData?.top_events?.map((e) => e.name) ?? [];
  const propertyKeys = propertyData?.keys ?? [];

  const openEditDialog = () => {
    if (!cohort) return;
    setEditName(cohort.name);
    setEditDescription(cohort.description ?? "");
    setEditDefinition(cohort.definition);
    setEditError("");
    setShowEdit(true);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("Cohort name is required");
      return;
    }
    if (editDefinition.rules.length === 0) {
      setEditError("At least one rule is required");
      return;
    }
    setEditError("");
    await updateCohort.mutateAsync({
      projectId: id!,
      cohortId: cohortId!,
      input: {
        name: trimmedName,
        description: editDescription.trim() || undefined,
        definition: editDefinition,
      },
    });
    setShowEdit(false);
  };

  const handleDelete = () => {
    deleteCohort.mutate(
      { projectId: id!, cohortId: cohortId! },
      { onSuccess: () => navigate(`/projects/${id}/cohorts`) },
    );
    setShowDeleteConfirm(false);
  };

  if (cohortLoading) {
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

  if (!cohort) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Cohort not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header title={cohort.name} />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/projects/${id}/cohorts`)}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {sizeLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : sizeData ? (
              <Badge className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {formatNumber(sizeData.size)} users
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Edit className="h-3 w-3" />
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

        {/* Definition viewer */}
        <Card>
          <CardHeader>
            <CardTitle>Definition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Users matching{" "}
                <span className="font-medium text-foreground">
                  {cohort.definition.operator === "and" ? "all" : "any"}
                </span>{" "}
                of the following rules:
              </p>
              <div className="space-y-2">
                {cohort.definition.rules.map((rule, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                    className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm"
                  >
                    <Badge variant="secondary" className="shrink-0">
                      {i + 1}
                    </Badge>
                    {rule.type === "event" ? (
                      <span>
                        Performed{" "}
                        <span className="font-medium">{rule.event_name}</span>{" "}
                        {EVENT_OP_LABELS[rule.op ?? "gte"] ?? rule.op}{" "}
                        <span className="font-medium">{rule.count}</span>{" "}
                        {rule.count === 1 ? "time" : "times"}
                        {rule.time_window && (
                          <>
                            {" "}
                            in the last{" "}
                            <span className="font-medium">{rule.time_window}</span>
                          </>
                        )}
                      </span>
                    ) : (
                      <span>
                        Property{" "}
                        <span className="font-medium">{rule.property}</span>{" "}
                        {PROPERTY_OP_LABELS[rule.op ?? "eq"] ?? rule.op}
                        {rule.op !== "exists" && rule.value && (
                          <>
                            {" "}
                            <span className="font-medium">&quot;{rule.value}&quot;</span>
                          </>
                        )}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users list */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {usersLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !usersData || usersData.data.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No users match this cohort definition.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>User ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.data.map((userId, i) => (
                      <TableRow key={userId}>
                        <TableCell className="text-muted-foreground">
                          {(page - 1) * perPage + i + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {userId}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!usersData.meta.has_more}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Cohort</DialogTitle>
            <DialogDescription>
              Modify the cohort definition and settings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  if (editError) setEditError("");
                }}
                placeholder="Cohort name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description (optional)</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe this cohort..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Rules</Label>
              <CohortBuilder
                definition={editDefinition}
                onChange={setEditDefinition}
                eventNames={eventNames}
                propertyKeys={propertyKeys}
              />
            </div>

            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEdit(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateCohort.isPending}>
                {updateCohort.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{cohort.name}&quot;? This
              action cannot be undone.
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
