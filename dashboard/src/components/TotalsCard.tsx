import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { motion } from "motion/react";
import { formatNumber } from "@/lib/utils";

interface TotalRow {
  event_name?: string;
  group: Record<string, string>;
  value: number;
}

interface TotalsCardProps {
  totals: TotalRow[];
  isLoading: boolean;
  /** Show an event_name column (for multi-event views like Trends). */
  showEventColumn?: boolean;
}

function formatGroupLabel(group: Record<string, string>): string {
  return Object.keys(group).length === 0
    ? "All"
    : Object.entries(group)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
}

export function TotalsCard({ totals, isLoading, showEventColumn = false }: TotalsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : totals.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No data
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  {showEventColumn && <TableHead>Event</TableHead>}
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.map((total, i) => (
                  <TableRow key={i}>
                    {showEventColumn && (
                      <TableCell className="font-medium">
                        {total.event_name}
                      </TableCell>
                    )}
                    <TableCell className={showEventColumn ? "" : "font-medium"}>
                      {formatGroupLabel(total.group)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(total.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
