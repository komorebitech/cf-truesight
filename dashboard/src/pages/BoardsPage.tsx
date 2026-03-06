import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useBoards, useCreateBoard, useDeleteBoard } from "@/hooks/use-boards";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const handleCreate = async () => {
    await createBoard.mutateAsync({
      name,
      description: description || undefined,
    });
    setShowCreate(false);
    setName("");
    setDescription("");
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Boards" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutGrid className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 font-heading text-lg font-medium">
              No boards yet
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Create a board to build custom dashboards with widgets.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Board
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {boards.map((board, i) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() =>
                    navigate(`/projects/${id}/boards/${board.id}`)
                  }
                >
                  <CardContent className="p-5">
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-heading text-base font-semibold">
                        {board.name}
                      </h3>
                      {board.is_default && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Default
                        </span>
                      )}
                    </div>
                    {board.description && (
                      <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                        {board.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Updated{" "}
                        {new Date(board.updated_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteBoardId(board.id);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Board</DialogTitle>
            <DialogDescription>
              Create a new dashboard board to organize your widgets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="board-name">Name</Label>
              <Input
                id="board-name"
                placeholder="My Dashboard"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-desc">Description (optional)</Label>
              <Textarea
                id="board-desc"
                placeholder="A brief description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createBoard.isPending}
            >
              {createBoard.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Are you sure you want to delete this board and all its widgets?
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
    </div>
  );
}
