import { motion } from "motion/react";
import { Skeleton } from "./skeleton";
import { TableCell, TableRow } from "./table";
import { cn } from "@/lib/utils";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

interface SkeletonTableRowProps {
  columns: unknown[];
  index: number;
  widthPattern?: "varied" | "uniform";
}

function SkeletonTableRow({
  columns,
  index,
  widthPattern = "varied",
}: SkeletonTableRowProps) {
  const getWidth = (colIndex: number) => {
    if (widthPattern === "uniform") return "w-full";
    const patterns = ["w-full", "w-4/5", "w-3/4", "w-2/3", "w-full"];
    return patterns[(colIndex + index) % patterns.length];
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.3,
        ease: easeOutExpo,
      }}
      className="border-b border-border/50"
    >
      {columns.map((_, colIndex) => (
        <TableCell key={colIndex} className="py-3">
          <Skeleton
            className={cn("h-4", getWidth(colIndex))}
            style={{
              animationDelay: `${(index * columns.length + colIndex) * 0.02}s`,
            }}
          />
        </TableCell>
      ))}
    </motion.tr>
  );
}

interface SkeletonTableProps {
  columns?: unknown[];
  rows?: number;
  showHeader?: boolean;
}

function SkeletonTable({
  columns = [],
  rows = 5,
  showHeader = false,
}: SkeletonTableProps) {
  const columnCount = columns.length || 5;
  const columnsArray =
    columns.length > 0 ? columns : Array.from({ length: columnCount });

  return (
    <>
      {showHeader && (
        <TableRow className="bg-muted/30">
          {columnsArray.map((_, colIndex) => (
            <TableCell key={colIndex} className="py-2">
              <Skeleton className="h-3 w-1/2" shimmer={false} />
            </TableCell>
          ))}
        </TableRow>
      )}
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonTableRow
          key={`skeleton-row-${index}`}
          columns={columnsArray}
          index={index}
        />
      ))}
    </>
  );
}

export { SkeletonTable, SkeletonTableRow };
