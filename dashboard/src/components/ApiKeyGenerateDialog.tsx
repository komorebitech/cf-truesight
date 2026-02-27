import { useState, type FormEvent } from "react";
import { Dialog, DialogHeader, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { copyToClipboard } from "@/lib/utils";
import { Copy, Check, AlertTriangle } from "lucide-react";

interface ApiKeyGenerateDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (label: string, environment: "live" | "test") => void;
  isGenerating: boolean;
  generatedKey: string | null;
}

export function ApiKeyGenerateDialog({
  open,
  onClose,
  onGenerate,
  isGenerating,
  generatedKey,
}: ApiKeyGenerateDialogProps) {
  const [label, setLabel] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("test");
  const [labelError, setLabelError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setLabelError("Label is required");
      return;
    }
    setLabelError("");
    onGenerate(trimmed, environment);
  };

  const handleCopy = async () => {
    if (generatedKey) {
      const ok = await copyToClipboard(generatedKey);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleClose = () => {
    setLabel("");
    setEnvironment("test");
    setLabelError("");
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>
        {generatedKey ? "API Key Generated" : "Generate API Key"}
      </DialogHeader>

      {generatedKey ? (
        <>
          <DialogContent>
            <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Copy this key now. It will not be shown again.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm break-all">
                {generatedKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="key-label"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Label
                </label>
                <Input
                  id="key-label"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (labelError) setLabelError("");
                  }}
                  placeholder="e.g. Production Backend"
                  autoFocus
                />
                {labelError && (
                  <p className="mt-1 text-sm text-red-600">{labelError}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="key-env"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Environment
                </label>
                <Select
                  id="key-env"
                  value={environment}
                  onChange={(e) =>
                    setEnvironment(e.target.value as "live" | "test")
                  }
                >
                  <option value="test">Test</option>
                  <option value="live">Live</option>
                </Select>
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Key"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
