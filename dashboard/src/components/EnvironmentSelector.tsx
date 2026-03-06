import { cn } from "@/lib/utils";

interface EnvironmentSelectorProps {
  value: "live" | "test";
  onChange: (env: "live" | "test") => void;
}

export function EnvironmentSelector({ value, onChange }: EnvironmentSelectorProps) {
  return (
    <div className="inline-flex h-9 items-center gap-0.5 rounded-lg border bg-background p-1">
      <button
        type="button"
        onClick={() => onChange("live")}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
          value === "live"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => onChange("test")}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
          value === "test"
            ? "bg-amber-500 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Test
      </button>
    </div>
  );
}
