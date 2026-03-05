import type { RetentionCohort } from "@/lib/api";
import { motion } from "motion/react";

interface RetentionMatrixProps {
  cohorts: RetentionCohort[];
  retentionType: string;
}

function periodLabel(type: string): string {
  switch (type) {
    case "week":
      return "Week";
    case "month":
      return "Month";
    default:
      return "Day";
  }
}

function formatCohortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function RetentionMatrix({ cohorts, retentionType }: RetentionMatrixProps) {
  if (cohorts.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No retention data available
      </div>
    );
  }

  const maxPeriods = Math.max(...cohorts.map((c) => c.retention.length));
  const label = periodLabel(retentionType);

  return (
    <div className="w-full overflow-auto">
      <table className="w-full caption-bottom text-sm">
        <thead className="border-b">
          <tr>
            <th className="h-10 px-3 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cohort
            </th>
            <th className="h-10 px-3 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Users
            </th>
            {Array.from({ length: maxPeriods }).map((_, i) => (
              <th
                key={i}
                className="h-10 px-2 text-center align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {label} {i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort, rowIdx) => (
            <motion.tr
              key={cohort.cohort_date}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: rowIdx * 0.03 }}
              className="border-b border-border/50"
            >
              <td className="px-3 py-2 align-middle text-sm font-medium">
                {formatCohortDate(cohort.cohort_date)}
              </td>
              <td className="px-3 py-2 text-right align-middle text-sm text-muted-foreground">
                {cohort.cohort_size.toLocaleString()}
              </td>
              {Array.from({ length: maxPeriods }).map((_, colIdx) => {
                const value = cohort.retention[colIdx];
                if (value === undefined) {
                  return (
                    <td
                      key={colIdx}
                      className="px-2 py-2 text-center align-middle text-sm text-muted-foreground"
                    >
                      -
                    </td>
                  );
                }
                const opacity = Math.min(value / 100, 1) * 0.6 + 0.05;
                return (
                  <td
                    key={colIdx}
                    className="px-2 py-2 text-center align-middle text-sm font-medium"
                    style={{
                      backgroundColor: `hsl(var(--chart-1) / ${opacity})`,
                    }}
                  >
                    {value.toFixed(1)}%
                  </td>
                );
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
