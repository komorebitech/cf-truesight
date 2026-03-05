import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

const MAX_BREAKDOWNS = 3;

interface BreakdownSelectorProps {
  value: string[];
  onChange: (keys: string[]) => void;
  propertyKeys: string[];
}

export function BreakdownSelector({
  value,
  onChange,
  propertyKeys,
}: BreakdownSelectorProps) {
  const availableKeys = propertyKeys.filter((k) => !value.includes(k));

  const addBreakdown = (key: string) => {
    if (key && value.length < MAX_BREAKDOWNS) {
      onChange([...value, key]);
    }
  };

  const removeBreakdown = (key: string) => {
    onChange(value.filter((k) => k !== key));
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Breakdown
      </Label>

      <div className="flex flex-wrap items-center gap-2">
        {value.map((key) => (
          <Badge key={key} variant="secondary" className="gap-1 pr-1">
            {key}
            <button
              onClick={() => removeBreakdown(key)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {value.length < MAX_BREAKDOWNS && availableKeys.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value=""
              onChange={(e) => addBreakdown(e.target.value)}
              className="w-44"
            >
              <option value="" disabled>
                Add breakdown...
              </option>
              {availableKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          </div>
        )}

        {value.length === 0 && availableKeys.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No properties available
          </p>
        )}
      </div>

      {value.length >= MAX_BREAKDOWNS && (
        <p className="text-xs text-muted-foreground">
          Maximum {MAX_BREAKDOWNS} breakdowns
        </p>
      )}
    </div>
  );
}
