import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useUsers } from "@/hooks/use-users-ch";
import { PageLayout } from "@/components/PageLayout";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Users } from "lucide-react";
import { cn, formatDate, formatNumber } from "@/lib/utils";
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

// Warm-toned avatar palette — rotates by string hash
const AVATAR_COLORS = [
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
];

function getInitials(name: string, email: string, uid: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return uid.slice(0, 2).toUpperCase();
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
        header: "User",
        cell: ({ row }) => {
          const { user_uid, name, email } = row.original;
          const initials = getInitials(name, email, user_uid);
          const colorClass = AVATAR_COLORS[hashStr(user_uid) % AVATAR_COLORS.length]!;
          return (
            <Link
              to={`/projects/${id}/users/${encodeURIComponent(user_uid)}`}
              className="inline-flex items-center gap-2.5 font-medium text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  colorClass,
                )}
              >
                {initials}
              </span>
              <span className="truncate">{name || user_uid}</span>
            </Link>
          );
        },
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
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              title={debouncedSearch ? "No users matched" : "Your users will show up here"}
              description={
                debouncedSearch
                  ? "Try a different name, email, or user ID"
                  : "Once users trigger identify events, they'll appear in this list"
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
