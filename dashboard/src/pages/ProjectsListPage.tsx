import { useState } from "react";
import { useNavigate } from "react-router";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useEventCount } from "@/hooks/use-stats";
import { formatDate, formatNumber } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { ProjectForm } from "@/components/ProjectForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FolderOpen } from "lucide-react";
import { useTableParams } from "@/hooks/use-table-params";
import type { ColumnDef } from "@tanstack/react-table";
import type { Project } from "@/lib/api";

function ProjectEventCount({ projectId }: { projectId: string }) {
  const { data, isLoading } = useEventCount(projectId);
  if (isLoading) return <Skeleton className="h-5 w-12" />;
  return <span>{formatNumber(data?.total_events ?? 0)}</span>;
}

export function ProjectsListPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [showCreate, setShowCreate] = useState(false);

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

  const { data, isLoading } = useProjects({
    page,
    per_page: pageSize,
    sort_by: sortParam,
    sort_order: orderParam,
  });

  const projects = data?.data ?? [];
  const total = data?.meta?.total;
  const hasMore = data?.meta?.has_more ?? false;

  const columns: ColumnDef<Project, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      id: "events",
      header: "Events",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          <ProjectEventCount projectId={row.original.id} />
        </span>
      ),
      enableSorting: false,
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
      header: "Created At",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
  ];

  return (
    <PageLayout title="Projects" spacing={false}>
        {/* Actions bar */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
              : `${total ?? projects.length} project${(total ?? projects.length) !== 1 ? "s" : ""}`}
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        </div>

        {/* Table */}
        {!isLoading && projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 font-heading text-lg font-medium">
              No projects yet
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Create your first project to start tracking events.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={projects}
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
            onRowClick={(project) => navigate(`/projects/${project.id}`)}
          />
        )}
      {/* Create Project Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Add a new project to start tracking events.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            onSubmit={async (values) => {
              const project = await createProject.mutateAsync(values);
              setShowCreate(false);
              navigate(`/projects/${project.id}`);
            }}
            onCancel={() => setShowCreate(false)}
            isSubmitting={createProject.isPending}
            submitLabel="Create Project"
          />
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
