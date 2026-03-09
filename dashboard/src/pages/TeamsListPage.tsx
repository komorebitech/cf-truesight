import { useState } from "react";
import { useNavigate } from "react-router";
import { useTeams, useCreateTeam } from "@/hooks/use-teams";
import { formatDate } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Plus, Users } from "lucide-react";
import { useTableParams } from "@/hooks/use-table-params";
import { motion } from "motion/react";
import { fadeInUp } from "@/lib/motion";
import type { ColumnDef } from "@tanstack/react-table";
import type { Team } from "@/lib/api";
import { type FormEvent } from "react";

export function TeamsListPage() {
  const navigate = useNavigate();
  const createTeam = useCreateTeam();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");

  const {
    sorting,
    onSortingChange,
    page,
    pageSize,
    onPageChange,
    sortParam,
    orderParam,
  } = useTableParams({
    defaultSortField: "created_at",
    defaultSortOrder: "desc",
    pageSize: 20,
  });

  const { data, isLoading } = useTeams({
    page,
    per_page: pageSize,
    sort_by: sortParam,
    sort_order: orderParam,
  });

  const teams = data?.data ?? [];
  const total = data?.meta?.total;
  const hasMore = data?.meta?.has_more ?? false;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError("Team name is required");
      return;
    }
    if (trimmed.length < 2) {
      setNameError("Team name must be at least 2 characters");
      return;
    }
    setNameError("");
    await createTeam.mutateAsync(trimmed);
    setNewName("");
    setShowCreate(false);
  };

  const columns: ColumnDef<Team, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "success" : "secondary"}>
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
  ];

  return (
    <PageLayout title="Teams" spacing={false}>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "\u00A0"
            : `${total ?? teams.length} team${(total ?? teams.length) !== 1 ? "s" : ""}`}
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create Team
        </Button>
      </div>

      {!isLoading && teams.length === 0 ? (
        <EmptyState
          variant="data"
          icon={Users}
          title="No teams yet"
          description="Create a team to collaborate with others"
          action={{
            label: "Create Team",
            onClick: () => setShowCreate(true),
          }}
        />
      ) : (
        <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
          <DataTable
            columns={columns}
            data={teams}
            sorting={sorting}
            onSortingChange={onSortingChange}
            pagination={{
              page,
              pageSize,
              hasMore,
              total: total ?? undefined,
            }}
            onPageChange={onPageChange}
            isLoading={isLoading}
            onRowClick={(team) => navigate(`/teams/${team.id}`)}
          />
        </motion.div>
      )}

      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            setNewName("");
            setNameError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>
                  Create a new team to manage projects collaboratively
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="team-name" className="block text-sm font-medium">
                Team Name
              </label>
              <Input
                id="team-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="e.g. Engineering"
                autoFocus
              />
              {nameError && (
                <p className="text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTeam.isPending}>
                {createTeam.isPending ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
