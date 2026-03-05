import { useCohorts } from "@/hooks/use-cohorts";
import { Select } from "@/components/ui/select";

interface CohortFilterProps {
  projectId: string;
  value: string | undefined;
  onChange: (cohortId: string | undefined) => void;
}

export function CohortFilter({ projectId, value, onChange }: CohortFilterProps) {
  const { data: cohorts, isLoading } = useCohorts(projectId);

  return (
    <Select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-48"
      disabled={isLoading}
    >
      <option value="">No cohort filter</option>
      {cohorts?.map((cohort) => (
        <option key={cohort.id} value={cohort.id}>
          {cohort.name}
        </option>
      ))}
    </Select>
  );
}
