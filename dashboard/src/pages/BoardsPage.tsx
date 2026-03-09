import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router";
import { useBoards, useCreateBoard, useDeleteBoard } from "@/hooks/use-boards";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, LayoutGrid, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { fadeInUp } from "@/lib/motion";
import { formatDateShort } from "@/lib/utils";

export function BoardsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: boards, isLoading } = useBoards(id);
  const createBoard = useCreateBoard(id);
  const deleteBoard = useDeleteBoard(id);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");

  const deleteBoardName = boards?.find((b) => b.id === deleteBoardId)?.name;

  const resetForm = () => {
    setName("");
    setDescription("");
    setNameError("");
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Board name is required");
      return;
    }
    setNameError("");
    await createBoard.mutateAsync({
      name: trimmed,
      description: description.trim() || undefined,
    });
    setShowCreate(false);
    resetForm();
  };

  return (
    <PageLayout title="Boards" spacing={false}>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "\u00A0"
            : `${boards?.length ?? 0} board${(boards?.length ?? 0) !== 1 ? "s" : ""}`}
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create Board
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !boards || boards.length === 0 ? (
        <EmptyState
          variant="data"
          icon={LayoutGrid}
          title="No boards yet"
          description="Create a board to build custom dashboards with widgets"
          action={{
            label: "Create Board",
            onClick: () => setShowCreate(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board, i) => (
            <motion.div
              key={board.id}
              {...fadeInUp}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card
                className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20"
                onClick={() =>
                  navigate(`/projects/${id}/boards/${board.id}`)
                }
              >
                <CardContent className="px-5 py-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-heading text-base font-semibold truncate">
                      {board.name}
                    </h3>
                    {board.is_default && (
                      <Badge variant="outline" className="shrink-0">
                        Default
                      </Badge>
                    )}
                  </div>
                  {board.description && (
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                      {board.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Updated {formatDateShort(board.updated_at)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteBoardId(board.id);
                      }}
                      className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <LayoutGrid className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Create Board</DialogTitle>
                <DialogDescription>
                  Build a custom dashboard with widgets
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="board-name">Name</Label>
              <Input
                id="board-name"
                placeholder="e.g. Growth Dashboard"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }}
                autoFocus
              />
              {nameError && (
                <p className="text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-desc">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="board-desc"
                placeholder="A brief description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
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
              <Button type="submit" disabled={createBoard.isPending}>
                {createBoard.isPending ? "Creating..." : "Create Board"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteBoardId}
        onOpenChange={(open) => {
          if (!open) setDeleteBoardId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Board</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteBoardName}&quot; and all its widgets?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteBoardId) {
                  deleteBoard.mutate(deleteBoardId);
                  setDeleteBoardId(null);
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
