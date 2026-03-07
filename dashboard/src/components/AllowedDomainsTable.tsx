import { useState, type FormEvent } from "react";
import { type AllowedDomain } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";

interface AllowedDomainsTableProps {
  domains: AllowedDomain[] | undefined;
  isLoading: boolean;
  onAdd: (domain: string, defaultRole: string) => Promise<void>;
  onRemove: (domainId: string) => void;
  isAdding: boolean;
}

export function AllowedDomainsTable({
  domains,
  isLoading,
  onAdd,
  onRemove,
  isAdding,
}: AllowedDomainsTableProps) {
  const [newDomain, setNewDomain] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [error, setError] = useState("");

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) {
      setError("Domain is required");
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(trimmed)) {
      setError("Invalid domain format");
      return;
    }
    setError("");
    await onAdd(trimmed, newRole);
    setNewDomain("");
    setNewRole("viewer");
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex items-end gap-3 px-4 pt-4">
        <div className="flex-1">
          <label htmlFor="new-domain" className="mb-1.5 block text-sm font-medium">
            Domain
          </label>
          <Input
            id="new-domain"
            value={newDomain}
            onChange={(e) => {
              setNewDomain(e.target.value);
              if (error) setError("");
            }}
            placeholder="example.com"
          />
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
        <div className="w-32">
          <label htmlFor="new-domain-role" className="mb-1.5 block text-sm font-medium">
            Default Role
          </label>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={isAdding}>
          {isAdding ? "Adding..." : "Add"}
        </Button>
      </form>

      {!domains || domains.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No allowed domains configured.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Default Role</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.domain}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{d.default_role}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(d.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
