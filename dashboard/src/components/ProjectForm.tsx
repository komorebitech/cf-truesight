import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ProjectFormValues {
  name: string;
}

interface ProjectFormProps {
  initialValues?: ProjectFormValues;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function ProjectForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Create Project",
}: ProjectFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required");
      return;
    }
    if (trimmed.length < 2) {
      setError("Project name must be at least 2 characters");
      return;
    }
    setError("");
    onSubmit({ name: trimmed });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="project-name"
          className="mb-1.5 block text-sm font-medium"
        >
          Project Name
        </label>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          placeholder="My Project"
          autoFocus
        />
        {error && (
          <p className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

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
