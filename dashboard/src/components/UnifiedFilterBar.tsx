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
    <div className="space-y-4">
      {/* Top bar: environment, time range, and optionally cohort */}
      <div className="flex flex-wrap items-center gap-3">
        <EnvironmentSelector value={environment} onChange={onEnvironmentChange} />
        <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        {showCohortFilter && (
          <CohortFilter
            projectId={projectId}
            value={cohortId}
            onChange={onCohortChange}
          />
        )}
      </div>

      {/* Property filters section */}
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
