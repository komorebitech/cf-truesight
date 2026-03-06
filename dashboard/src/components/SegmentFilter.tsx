import { useSegments } from "@/hooks/use-segments";
import { Select } from "@/components/ui/select";

interface SegmentFilterProps {
  projectId: string | undefined;
  value: string | undefined;
  onChange: (segmentId: string | undefined) => void;
  className?: string;
}

export function SegmentFilter({ projectId, value, onChange, className }: SegmentFilterProps) {
  const { data: segments } = useSegments(projectId);

  if (!segments || segments.length === 0) return null;

  return (
    <Select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={className}
    >
      <option value="">All users</option>
      {segments.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
