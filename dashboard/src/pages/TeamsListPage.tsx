import { useState } from "react";
import { useNavigate } from "react-router";
import { useTeams, useCreateTeam } from "@/hooks/use-teams";
import { formatDate } from "@/lib/utils";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Plus, Users } from "lucide-react";
import { useTableParams } from "@/hooks/use-table-params";
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
          {row.original.active ? "active" : "inactive"}
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
    <div className="flex flex-1 flex-col">
      <Header title="Teams" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
              : `${total ?? teams.length} team${(total ?? teams.length) !== 1 ? "s" : ""}`}
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </div>

        {!isLoading && teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 font-heading text-lg font-medium">
              No teams yet
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Create a team to collaborate with others.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          </div>
        ) : (
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
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>
              Create a new team to manage projects collaboratively.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="team-name" className="mb-1.5 block text-sm font-medium">
                Team Name
              </label>
              <Input
                id="team-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="My Team"
                autoFocus
              />
              {nameError && (
                <p className="mt-1 text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTeam.isPending}>
                {createTeam.isPending ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
