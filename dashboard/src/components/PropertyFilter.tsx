import type { InsightsFilter } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "in", label: "in" },
  { value: "not_in", label: "not in" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "not exists" },
] as const;

const VALUE_HIDDEN_OPERATORS = new Set(["exists", "not_exists"]);

interface PropertyFilterProps {
  filters: InsightsFilter[];
  onChange: (filters: InsightsFilter[]) => void;
  propertyKeys: string[];
}

export function PropertyFilter({
  filters,
  onChange,
  propertyKeys,
}: PropertyFilterProps) {
  const updateFilter = (index: number, patch: Partial<InsightsFilter>) => {
    const next = filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
    // Clear value when switching to exists/not_exists
    const current = next[index];
    if (current && patch.operator && VALUE_HIDDEN_OPERATORS.has(patch.operator)) {
      const { value: _removed, ...rest } = current;
      next[index] = rest as InsightsFilter;
    }
    onChange(next);
  };

  const addFilter = () => {
    onChange([
      ...filters,
      { property: propertyKeys[0] ?? "", operator: "eq", value: "" },
    ]);
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Filters
      </Label>

      {filters.map((filter, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* Property key */}
          <Select value={filter.property || undefined} onValueChange={(v) => updateFilter(index, { property: v })}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Property..." />
            </SelectTrigger>
            <SelectContent>
              {propertyKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator */}
          <Select value={filter.operator} onValueChange={(v) => updateFilter(index, { operator: v })}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value */}
          {!VALUE_HIDDEN_OPERATORS.has(filter.operator) && (
            <Input
              placeholder={
                filter.operator === "in" || filter.operator === "not_in"
                  ? "val1, val2, ..."
                  : "Value"
              }
              value={
                Array.isArray(filter.value)
                  ? filter.value.join(", ")
                  : filter.value ?? ""
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (
                  filter.operator === "in" ||
                  filter.operator === "not_in"
                ) {
                  updateFilter(index, {
                    value: raw.split(",").map((s) => s.trim()),
                  });
                } else {
                  updateFilter(index, { value: raw });
                }
              }}
              className="w-44"
            />
          )}

          {/* Remove */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeFilter(index)}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addFilter}>
        <Plus className="h-4 w-4" />
        Add filter
      </Button>
    </div>
  );
}
