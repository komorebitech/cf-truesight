import { type TeamMember } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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

interface TeamMembersTableProps {
  members: TeamMember[] | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  currentUserId: string | undefined;
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
}

export function TeamMembersTable({
  members,
  isLoading,
  isAdmin,
  currentUserId,
  onRoleChange,
  onRemove,
}: TeamMembersTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No members yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          {isAdmin && <TableHead className="w-[60px]" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const initials = member.user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          const isSelf = member.user_id === currentUserId;

          return (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user.picture_url} alt={member.user.name} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{member.user.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {member.user.email}
              </TableCell>
              <TableCell>
                {isAdmin && !isSelf ? (
                  <Select
                    value={member.role}
                    onChange={(e) => onRoleChange(member.user_id, e.target.value)}
                    className="w-28"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </Select>
                ) : (
                  <Badge variant="secondary">{member.role}</Badge>
                )}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  {!isSelf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(member.user_id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
