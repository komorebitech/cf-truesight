import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { SortingState } from "@tanstack/react-table";

interface UseTableParamsOptions {
  defaultSortField?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultPage?: number;
  pageSize?: number;
}

export function useTableParams(options: UseTableParamsOptions = {}) {
  const {
    defaultSortField,
    defaultSortOrder = "desc",
    defaultPage = 1,
    pageSize = 25,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || defaultPage;

  const sorting: SortingState = useMemo(() => {
    const sort = searchParams.get("sort") ?? defaultSortField;
    if (!sort) return [];
    const order = searchParams.get("order") ?? defaultSortOrder;
    return [{ id: sort, desc: order === "desc" }];
  }, [searchParams, defaultSortField, defaultSortOrder]);

  const onSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const firstItem = next[0];
          if (next.length > 0 && firstItem) {
            params.set("sort", firstItem.id);
            params.set("order", firstItem.desc ? "desc" : "asc");
          } else {
            params.delete("sort");
            params.delete("order");
          }
          // Reset page to 1 on sort change
          params.delete("page");
          return params;
        },
        { replace: true },
      );
    },
    [sorting, setSearchParams],
  );

  const onPageChange = useCallback(
    (newPage: number) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (newPage <= 1) {
            params.delete("page");
          } else {
            params.set("page", String(newPage));
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Convenience: API-ready params
  const first = sorting[0] as { id: string; desc: boolean } | undefined;
  const sortParam = first?.id;
  const orderParam = first ? (first.desc ? "desc" : "asc") : undefined;

  return {
    sorting,
    onSortingChange,
    page,
    pageSize,
    onPageChange,
    sortParam,
    orderParam: orderParam as "asc" | "desc" | undefined,
  };
}
