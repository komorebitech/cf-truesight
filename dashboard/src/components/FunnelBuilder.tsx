import { useState, type FormEvent } from "react";
import type { FunnelStep } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  eventNames?: string[];
  onSubmit: (name: string, steps: FunnelStep[], windowSeconds: number) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function FunnelBuilder({
  initialName = "",
  initialSteps,
  initialWindow = 86400,
  eventNames = [],
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
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Funnel Name
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

      <div>
        <label className="mb-2 block text-sm font-medium">
          Steps
        </label>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <span className="w-6 shrink-0 text-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="flex-1">
                  {eventNames.length > 0 ? (
                    <Select
                      value={step.event_name}
                      onChange={(e) => updateStep(i, e.target.value)}
                    >
                      <option value="">Select event...</option>
                      {eventNames.map((en) => (
                        <option key={en} value={en}>
                          {en}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={step.event_name}
                      onChange={(e) => updateStep(i, e.target.value)}
                      placeholder="Event name"
                    />
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === steps.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 2}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {steps.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStep}
            className="mt-2"
          >
            <Plus className="h-3 w-3" />
            Add Step
          </Button>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Conversion Window
        </label>
        <Select
          value={String(windowSeconds)}
          onChange={(e) => setWindowSeconds(Number(e.target.value))}
        >
          {WINDOW_OPTIONS.map((opt) => (
            <option key={opt.value} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
