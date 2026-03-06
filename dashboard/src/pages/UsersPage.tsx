import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useUsers } from "@/hooks/use-users-ch";
import { Header } from "@/components/Header";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";
import { motion } from "motion/react";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 25;

export function UsersPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { environment } = useEnvironment();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading } = useUsers(id, {
    search: debouncedSearch || undefined,
    page,
    per_page: PAGE_SIZE,
    environment,
  });

  const users = data?.data;
  const hasMore = data?.meta?.has_more ?? false;

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Users" />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative ml-auto w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user ID, email, or name..."
              className="pl-8"
            />
          </div>
        </div>

        {/* Users table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonTable columns={Array.from({ length: 6 })} rows={8} />
              ) : !users || users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      variant={debouncedSearch ? "search" : "data"}
                      icon={Users}
                      title={debouncedSearch ? "No users found" : "No users yet"}
                      description={
                        debouncedSearch
                          ? "Try adjusting your search query"
                          : "Users will appear here once they are identified via events"
                      }
                      compact
                    />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, i) => (
                  <motion.tr
                    key={user.user_uid}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50"
                    onClick={() => navigate(`/projects/${id}/users/${encodeURIComponent(user.user_uid)}`)}
                  >
                    <TableCell>
                      <Link
                        to={`/projects/${id}/users/${encodeURIComponent(user.user_uid)}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {user.user_uid}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.first_seen)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.last_seen)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(user.event_count)}
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {users && users.length > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {page} &middot; {users.length} user{users.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
