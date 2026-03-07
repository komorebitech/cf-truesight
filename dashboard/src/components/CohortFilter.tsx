import { useCohorts } from "@/hooks/use-cohorts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CohortFilterProps {
  projectId: string;
  value: string | undefined;
  onChange: (cohortId: string | undefined) => void;
}

export function CohortFilter({ projectId, value, onChange }: CohortFilterProps) {
  const { data: cohorts, isLoading } = useCohorts(projectId);

  return (
    <Select
      value={value || "__all__"}
      onValueChange={(v) => onChange(v === "__all__" ? undefined : v)}
      disabled={isLoading}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="No cohort filter" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">No cohort filter</SelectItem>
        {cohorts?.map((cohort) => (
          <SelectItem key={cohort.id} value={cohort.id}>
            {cohort.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
