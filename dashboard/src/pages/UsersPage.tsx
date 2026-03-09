import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useUsers } from "@/hooks/use-users-ch";
import { PageLayout } from "@/components/PageLayout";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Users } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";
import { useTableParams } from "@/hooks/use-table-params";
import type { ColumnDef } from "@tanstack/react-table";

interface UserRow {
  user_uid: string;
  email: string;
  name: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function UsersPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { environment } = useEnvironment();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    sorting,
    onSortingChange,
    page,
    pageSize,
    onPageChange,
    sortParam,
    orderParam,
  } = useTableParams({
    defaultSortField: "last_seen",
    defaultSortOrder: "desc",
    pageSize: 25,
  });

  // Reset page when search changes
  useEffect(() => {
    onPageChange(1);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useUsers(id, {
    search: debouncedSearch || undefined,
    page,
    per_page: pageSize,
    environment,
    sort_by: sortParam,
    sort_order: orderParam,
  });

  const users = data?.data ?? [];
  const hasMore = data?.meta?.has_more ?? false;

  const columns: ColumnDef<UserRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "user_uid",
        header: "User ID",
        cell: ({ row }) => (
          <Link
            to={`/projects/${id}/users/${encodeURIComponent(row.original.user_uid)}`}
            className="font-medium text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.user_uid}
          </Link>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.email || "-"}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.name || "-"}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "first_seen",
        header: "First Seen",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.first_seen)}
          </span>
        ),
      },
      {
        accessorKey: "last_seen",
        header: "Last Seen",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.last_seen)}
          </span>
        ),
      },
      {
        accessorKey: "event_count",
        header: "Events",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatNumber(row.original.event_count)}
          </span>
        ),
        meta: { className: "text-right" },
      },
    ],
    [id],
  );

  return (
    <PageLayout title="Users">
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

        <DataTable
          columns={columns}
          data={users}
          sorting={sorting}
          onSortingChange={onSortingChange}
          pagination={{
            page,
            pageSize,
            hasMore,
          }}
          onPageChange={onPageChange}
          isLoading={isLoading}
          emptyState={
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
          }
          onRowClick={(user) =>
            navigate(
              `/projects/${id}/users/${encodeURIComponent(user.user_uid)}`,
            )
          }
        />
    </PageLayout>
  );
}
