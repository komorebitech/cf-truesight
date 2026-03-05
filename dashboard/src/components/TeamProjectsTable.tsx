import { useState } from "react";
import { type TeamProject, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { formatDate } from "@/lib/utils";
import { Link2Off, Plus } from "lucide-react";

interface TeamProjectsTableProps {
  teamProjects: TeamProject[] | undefined;
  allProjects: Project[] | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  onLink: (projectId: string) => Promise<void>;
  onUnlink: (projectId: string) => void;
  isLinking: boolean;
}

export function TeamProjectsTable({
  teamProjects,
  allProjects,
  isLoading,
  isAdmin,
  onLink,
  onUnlink,
  isLinking,
}: TeamProjectsTableProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const linkedIds = new Set(teamProjects?.map((tp) => tp.project_id) ?? []);
  const unlinkedProjects = (allProjects ?? []).filter((p) => !linkedIds.has(p.id));

  const handleLink = async () => {
    if (!selectedProjectId) return;
    await onLink(selectedProjectId);
    setSelectedProjectId("");
    setShowLinkDialog(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      {isAdmin && (
        <div className="flex justify-end p-4 pb-0">
          <Button size="sm" onClick={() => setShowLinkDialog(true)}>
            <Plus className="h-4 w-4" />
            Link Project
          </Button>
        </div>
      )}

      {!teamProjects || teamProjects.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No projects linked yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Linked</TableHead>
              {isAdmin && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamProjects.map((tp) => (
              <TableRow key={tp.id}>
                <TableCell className="font-medium">{tp.project.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(tp.created_at)}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onUnlink(tp.project_id)}
                    >
                      <Link2Off className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Project</DialogTitle>
            <DialogDescription>
              Select a project to link to this team.
            </DialogDescription>
          </DialogHeader>
          {unlinkedProjects.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              All projects are already linked to this team.
            </p>
          ) : (
            <div className="space-y-4">
              <Select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">Select a project...</option>
                {unlinkedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleLink}
                  disabled={!selectedProjectId || isLinking}
                >
                  {isLinking ? "Linking..." : "Link"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
