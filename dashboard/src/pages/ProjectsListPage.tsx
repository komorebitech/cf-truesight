import { useState } from "react";
import { useNavigate } from "react-router";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useEventCount } from "@/hooks/use-stats";
import { formatDate, formatNumber } from "@/lib/utils";
import { Header } from "@/components/Header";
import { ProjectForm } from "@/components/ProjectForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FolderOpen } from "lucide-react";

function ProjectEventCount({ projectId }: { projectId: string }) {
  const { data, isLoading } = useEventCount(projectId);
  if (isLoading) return <Skeleton className="h-5 w-12" />;
  return <span>{formatNumber(data?.total_events ?? 0)}</span>;
}

export function ProjectsListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useProjects();
  const createProject = useCreateProject();
  const [showCreate, setShowCreate] = useState(false);

  const projects = data?.data ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Projects" />

      <div className="flex-1 p-6">
        {/* Actions bar */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {isLoading
              ? "Loading..."
              : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-1 text-lg font-medium text-gray-900">
              No projects yet
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              Create your first project to start tracking events.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <TableCell className="font-medium">
                      {project.name}
                    </TableCell>
                    <TableCell>
                      <ProjectEventCount projectId={project.id} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={project.active ? "success" : "secondary"}
                      >
                        {project.active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(project.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader onClose={() => setShowCreate(false)}>
          Create Project
        </DialogHeader>
        <DialogContent>
          <ProjectForm
            onSubmit={async (values) => {
              await createProject.mutateAsync(values);
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
            isSubmitting={createProject.isPending}
            submitLabel="Create Project"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
