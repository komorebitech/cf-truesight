import { useState } from "react";
import type { ApiKey } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ApiKeyTableProps {
  apiKeys: ApiKey[] | undefined;
  isLoading: boolean;
  onRevoke: (keyId: string) => void;
  isRevoking?: boolean;
}

export function ApiKeyTable({
  apiKeys,
  isLoading,
  onRevoke,
  isRevoking,
}: ApiKeyTableProps) {
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No API keys generated yet. Create one to get started.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key Prefix</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map((key) => (
            <TableRow key={key.id}>
              <TableCell>
                <code className="rounded bg-muted px-2 py-0.5 text-xs">
                  {key.prefix}
                </code>
              </TableCell>
              <TableCell className="font-medium">
                {key.label}
              </TableCell>
              <TableCell>
                <Badge
                  variant={key.environment === "live" ? "success" : "secondary"}
                >
                  {key.environment}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={key.active ? "success" : "danger"}
                >
                  {key.active ? "active" : "revoked"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(key.created_at)}
              </TableCell>
              <TableCell className="text-right">
                {key.active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevokeKeyId(key.id)}
                    disabled={isRevoking}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Revoke
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!revokeKeyId}
        onOpenChange={(open) => { if (!open) setRevokeKeyId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this API key? This action cannot be undone.
              Any applications using this key will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeKeyId) {
                  onRevoke(revokeKeyId);
                  setRevokeKeyId(null);
                }
              }}
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
