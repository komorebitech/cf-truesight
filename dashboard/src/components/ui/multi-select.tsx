import * as React from "react";
import { Check, X, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface MultiSelectProps {
  options: Record<string, string | { value: string | number; label: string }>;
  value?: string[];
  onChange?: (value: string[] | undefined) => void;
  placeholder?: string;
  label?: string;
  showSearch?: boolean;
  className?: string;
}

function MultiSelect({
  options = {},
  value = [],
  onChange,
  placeholder = "Select...",
  label,
  showSearch = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const normalizedOptions = React.useMemo(() => {
    return Object.entries(options).map(([key, entry]) => {
      if (typeof entry === "object" && entry !== null) {
        return { value: String(entry.value), label: entry.label };
      }
      return { value: key, label: String(entry) };
    });
  }, [options]);

  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return [];
  }, [value]);

  const handleSelect = (optionValue: string) => {
    const newValue = selectedValues.includes(optionValue)
      ? selectedValues.filter((v) => v !== optionValue)
      : [...selectedValues, optionValue];
    onChange?.(newValue.length > 0 ? newValue : undefined);
  };

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.(undefined);
    setOpen(false);
  };

  const selectedLabels = normalizedOptions
    .filter((opt) => selectedValues.includes(opt.value))
    .map((opt) => opt.label);

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs text-muted-foreground">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between font-normal",
              !selectedValues.length && "text-muted-foreground",
            )}
          >
            <span className="flex-1 truncate text-left">
              {selectedValues.length > 0
                ? selectedValues.length === 1
                  ? selectedLabels[0]
                  : `${selectedValues.length} selected`
                : placeholder}
            </span>
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {selectedValues.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer rounded p-0.5 hover:bg-muted"
                  onClick={handleClear}
                  onKeyDown={(e) => e.key === "Enter" && handleClear(e)}
                >
                  <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
                </span>
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            {showSearch && (
              <CommandInput placeholder={`Search ${label || ""}...`} />
            )}
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {normalizedOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selectedValues.includes(option.value)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedValues.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedLabels.slice(0, 3).map((lbl, i) => (
            <Badge
              key={selectedValues[i]}
              variant="secondary"
              className="h-5 px-1.5 py-0 text-[10px]"
            >
              {lbl}
            </Badge>
          ))}
          {selectedLabels.length > 3 && (
            <Badge
              variant="secondary"
              className="h-5 px-1.5 py-0 text-[10px]"
            >
              +{selectedLabels.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export { MultiSelect };
