import { useState, type FormEvent } from "react";
import type { FunnelStep } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventCombobox } from "@/components/EventCombobox";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const WINDOW_OPTIONS = [
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "30 days", value: 2592000 },
];

interface FunnelBuilderProps {
  initialName?: string;
  initialSteps?: FunnelStep[];
  initialWindow?: number;
  projectId: string | undefined;
  environment?: string;
  onSubmit: (name: string, steps: FunnelStep[], windowSeconds: number) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function FunnelBuilder({
  initialName = "",
  initialSteps,
  initialWindow = 86400,
  projectId,
  environment,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Create Funnel",
}: FunnelBuilderProps) {
  const [name, setName] = useState(initialName);
  const [steps, setSteps] = useState<FunnelStep[]>(
    initialSteps ?? [{ event_name: "" }, { event_name: "" }],
  );
  const [windowSeconds, setWindowSeconds] = useState(initialWindow);
  const [error, setError] = useState("");

  const addStep = () => {
    if (steps.length >= 10) return;
    setSteps([...steps, { event_name: "" }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 2) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, eventName: string) => {
    setSteps(steps.map((s, i) => (i === index ? { ...s, event_name: eventName } : s)));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex]!, newSteps[index]!];
    setSteps(newSteps);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Funnel name is required");
      return;
    }
    const validSteps = steps.filter((s) => s.event_name.trim());
    if (validSteps.length < 2) {
      setError("At least 2 steps with event names are required");
      return;
    }
    setError("");
    onSubmit(trimmedName, validSteps, windowSeconds);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Name
        </label>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g. Purchase Funnel"
          autoFocus
        />
      </div>

      {/* Steps */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          Steps
        </label>
        <div className="relative">
          {/* Vertical connector line */}
          {steps.length > 1 && (
            <div
              className="absolute left-3 top-5 w-px bg-border"
              style={{ height: `calc(100% - 2.5rem)` }}
            />
          )}

          <div className="space-y-0">
            <AnimatePresence initial={false}>
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative flex items-center gap-2.5 py-1.5"
                >
                  {/* Step badge */}
                  <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>

                  {/* Event selector */}
                  <div className="flex-1">
                    <EventCombobox
                      projectId={projectId}
                      value={step.event_name}
                      onChange={(val) => updateStep(i, val)}
                      placeholder="Select event..."
                      environment={environment}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === steps.length - 1}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      disabled={steps.length <= 2}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      title="Remove step"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Connector to add button */}
        {steps.length < 10 && (
          <div className="relative ml-3 mt-0.5 flex items-center gap-2.5 pl-5 pt-1">
            {/* Short connector stub */}
            <div className="absolute -top-1 left-0 h-3 w-px bg-border" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStep}
              className="border-dashed"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Step
            </Button>
            {steps.length >= 8 && (
              <span className="text-xs text-muted-foreground">
                {10 - steps.length} remaining
              </span>
            )}
          </div>
        )}
      </div>

      {/* Window */}
      <div className="flex items-center gap-3">
        <label className="shrink-0 text-sm font-medium">
          Conversion Window
        </label>
        <Select value={String(windowSeconds)} onValueChange={(v) => setWindowSeconds(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
