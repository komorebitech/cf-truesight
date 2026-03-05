import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import {
  TimeRangeSelector,
  type TimeRange,
} from "@/components/TimeRangeSelector";
import { PropertyFilter } from "@/components/PropertyFilter";
import { CohortFilter } from "@/components/CohortFilter";
import type { InsightsFilter } from "@/lib/api";

interface UnifiedFilterBarProps {
  // Environment
  environment: "live" | "test";
  onEnvironmentChange: (env: "live" | "test") => void;
  // Time range
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  // Optional: property filters
  filters?: InsightsFilter[];
  onFiltersChange?: (filters: InsightsFilter[]) => void;
  propertyKeys?: string[];
  // Optional: cohort filter
  projectId?: string;
  cohortId?: string;
  onCohortChange?: (cohortId: string | undefined) => void;
}

export function UnifiedFilterBar({
  environment,
  onEnvironmentChange,
  timeRange,
  onTimeRangeChange,
  filters,
  onFiltersChange,
  propertyKeys,
  projectId,
  cohortId,
  onCohortChange,
}: UnifiedFilterBarProps) {
  const showPropertyFilters =
    filters !== undefined &&
    onFiltersChange !== undefined &&
    propertyKeys !== undefined;

  const showCohortFilter =
    projectId !== undefined && onCohortChange !== undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <EnvironmentSelector value={environment} onChange={onEnvironmentChange} />
        <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        {showCohortFilter && (
          <>
            <div className="h-6 w-px bg-border" />
            <CohortFilter
              projectId={projectId}
              value={cohortId}
              onChange={onCohortChange}
            />
          </>
        )}
      </div>

      {showPropertyFilters && (
        <PropertyFilter
          filters={filters}
          onChange={onFiltersChange}
          propertyKeys={propertyKeys}
        />
      )}
    </div>
  );
}
