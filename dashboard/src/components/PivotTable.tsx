import type { PivotsResponse } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface PivotTableProps {
  data: PivotsResponse | undefined;
  isLoading: boolean;
  rowLabel?: string;
  columnLabel?: string;
}

function heatmapBg(value: number, max: number): string {
  if (max === 0) return "";
  const opacity = Math.round((value / max) * 40 + 5);
  return `rgba(59, 130, 246, ${opacity / 100})`;
}

export function PivotTable({
  data,
  isLoading,
  rowLabel = "Row",
  columnLabel = "Column",
}: PivotTableProps) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!data || data.rows.length === 0 || data.columns.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data — select row and column dimensions to generate a pivot table.
      </div>
    );
  }

  const maxCell = Math.max(...data.cells.flat(), 0);

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background min-w-[140px]">
              {rowLabel} / {columnLabel}
            </TableHead>
            {data.columns.map((col) => (
              <TableHead key={col} className="text-right whitespace-nowrap">
                {col || "(empty)"}
              </TableHead>
            ))}
            <TableHead className="text-right font-bold whitespace-nowrap">
              Total
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, ri) => (
            <TableRow key={row}>
              <TableCell className="sticky left-0 z-10 bg-background font-medium whitespace-nowrap">
                {row || "(empty)"}
              </TableCell>
              {(data.cells[ri] ?? []).map((val, ci) => (
                <TableCell
                  key={data.columns[ci]}
                  className="text-right tabular-nums"
                  style={{ backgroundColor: heatmapBg(val, maxCell) }}
                >
                  {formatNumber(val)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums font-semibold">
                {formatNumber(data.row_totals[ri] ?? 0)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2">
            <TableCell className="sticky left-0 z-10 bg-background font-bold">
              Total
            </TableCell>
            {data.column_totals.map((val, ci) => (
              <TableCell
                key={data.columns[ci]}
                className="text-right tabular-nums font-semibold"
              >
                {formatNumber(val)}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums font-bold">
              {formatNumber(data.grand_total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
