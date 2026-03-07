import { useSegments } from "@/hooks/use-segments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      value={value || "__all__"}
      onValueChange={(v) => onChange(v === "__all__" ? undefined : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="All users" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All users</SelectItem>
        {segments.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
