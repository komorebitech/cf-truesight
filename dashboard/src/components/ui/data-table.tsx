import { useState, type ReactNode } from "react";
import {
  type ColumnDef,
  type Row,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { Button } from "@/components/ui/button";
import { fadeIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface DataTablePagination {
  page: number;
  pageSize: number;
  hasMore?: boolean;
  total?: number;
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  pagination?: DataTablePagination;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: TData) => void;
  renderSubRow?: (row: Row<TData>) => ReactNode;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  onSortingChange,
  pagination,
  onPageChange,
  isLoading,
  emptyState,
  onRowClick,
  renderSubRow,
  className,
}: DataTableProps<TData>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sorting ?? [],
    },
    onSortingChange: onSortingChange
      ? (updater) => {
          const next =
            typeof updater === "function"
              ? updater(sorting ?? [])
              : updater;
          onSortingChange(next);
        }
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
  });

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const totalPages = pagination?.total
    ? Math.ceil(pagination.total / pagination.pageSize)
    : undefined;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();

                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      canSort && "cursor-pointer select-none",
                      header.column.columnDef.meta?.className,
                    )}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        header.column.columnDef.meta?.className?.includes(
                          "text-right",
                        ) && "justify-end",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {canSort &&
                        (sorted === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        ))}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonTable columns={columns as unknown[]} rows={8} />
          ) : table.getRowModel().rows.length === 0 ? (
            emptyState ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )
          ) : (
            table.getRowModel().rows.map((row, i) => {
              const isExpanded = expandedRows.has(row.id);

              return (
                <AnimatePresence key={row.id}>
                  <motion.tr
                    {...fadeIn}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-muted/50",
                      (onRowClick || renderSubRow) && "cursor-pointer",
                    )}
                    onClick={() => {
                      if (renderSubRow) {
                        toggleRow(row.id);
                      }
                      onRowClick?.(row.original);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </motion.tr>

                  {renderSubRow && isExpanded && (
                    <motion.tr
                      key={`${row.id}-expanded`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-b border-border/50"
                    >
                      <td colSpan={columns.length}>
                        {renderSubRow(row)}
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {pagination && data.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page}
            {pagination.total != null && (
              <> &middot; {pagination.total} total</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {totalPages
                ? `Page ${pagination.page} of ${totalPages}`
                : `Page ${pagination.page}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={
                pagination.hasMore === false ||
                (totalPages != null && pagination.page >= totalPages)
              }
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
