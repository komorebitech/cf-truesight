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
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No API keys generated yet. Create one to get started.
      </div>
    );
  }

  return (
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
              <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                {key.prefix}
              </code>
            </TableCell>
            <TableCell className="font-medium">{key.label}</TableCell>
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
            <TableCell className="text-gray-500">
              {formatDate(key.created_at)}
            </TableCell>
            <TableCell className="text-right">
              {key.active && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevoke(key.id)}
                  disabled={isRevoking}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Revoke
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
