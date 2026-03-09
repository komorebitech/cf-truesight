import type { SegmentDefinition, SegmentRule } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EventCombobox } from "@/components/EventCombobox";
import { X, Plus, Zap, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const EVENT_OPERATORS = [
  { label: ">= (at least)", value: "gte" },
  { label: "<= (at most)", value: "lte" },
  { label: "= (exactly)", value: "eq" },
];

const PROPERTY_OPERATORS = [
  { label: "equals", value: "eq" },
  { label: "not equals", value: "neq" },
  { label: "contains", value: "contains" },
  { label: "exists", value: "exists" },
];

const TIME_WINDOW_TYPES = [
  { label: "Last N days/hours", value: "relative" },
  { label: "All time", value: "ever" },
];

interface SegmentBuilderProps {
  definition: SegmentDefinition;
  onChange: (def: SegmentDefinition) => void;
  projectId: string | undefined;
  environment?: string;
  propertyKeys: string[];
}

function makeDefaultEventRule(): SegmentRule {
  return {
    type: "event",
    event_name: "",
    action: "did",
    op: "gte",
    count: 1,
    time_window: "30d",
  };
}

function makeDefaultPropertyRule(): SegmentRule {
  return { type: "property", property: "", op: "eq", value: "", source: "user" };
}

export function SegmentBuilder({
  definition,
  onChange,
  projectId,
  environment,
  propertyKeys,
}: SegmentBuilderProps) {
  const { operator, rules } = definition;

  const setOperator = (op: string) => {
    onChange({ ...definition, operator: op as "and" | "or" });
  };

  const updateRule = (index: number, updated: SegmentRule) => {
    const next = [...rules];
    next[index] = updated;
    onChange({ ...definition, rules: next });
  };

  const removeRule = (index: number) => {
    onChange({ ...definition, rules: rules.filter((_, i) => i !== index) });
  };

  const addRule = () => {
    onChange({ ...definition, rules: [...rules, makeDefaultEventRule()] });
  };

  const switchRuleType = (index: number, type: "event" | "property") => {
    if (type === "event") {
      updateRule(index, makeDefaultEventRule());
    } else {
      updateRule(index, makeDefaultPropertyRule());
    }
  };

  const getTimeWindowValue = (rule: SegmentRule): string => {
    if (!rule.time_window) return "30d";
    if (typeof rule.time_window === "string") return rule.time_window;
    if (rule.time_window.type === "ever") return "";
    return rule.time_window.value ?? "30d";
  };

  const getTimeWindowType = (rule: SegmentRule): string => {
    if (!rule.time_window) return "relative";
    if (typeof rule.time_window === "string") return "relative";
    return rule.time_window.type;
  };

  return (
    <div className="space-y-4">
      {/* AND / OR toggle */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <span className="text-sm font-medium text-foreground">Match</span>
        <Tabs value={operator} onValueChange={setOperator}>
          <TabsList>
            <TabsTrigger value="and" className="font-semibold">All rules (AND)</TabsTrigger>
            <TabsTrigger value="or" className="font-semibold">Any rule (OR)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {rules.map((rule, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={cn(
                  "rounded-lg border-l-[3px] border bg-card p-3",
                  rule.type === "event"
                    ? "border-l-primary"
                    : "border-l-[hsl(var(--chart-6))]",
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                      rule.type === "event"
                        ? "bg-primary/10 text-primary"
                        : "bg-[hsl(var(--chart-6)/0.1)] text-[hsl(var(--chart-6))]",
                    )}
                  >
                    {i + 1}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Type toggle */}
                    <Tabs
                      value={rule.type}
                      onValueChange={(v) => switchRuleType(i, v as "event" | "property")}
                    >
                      <TabsList className="h-8">
                        <TabsTrigger value="event" className="gap-1 text-xs">
                          <Zap className="h-3 w-3" />
                          Event
                        </TabsTrigger>
                        <TabsTrigger value="property" className="gap-1 text-xs">
                          <SlidersHorizontal className="h-3 w-3" />
                          Property
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {rule.type === "event" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={rule.action ?? "did"}
                          onValueChange={(v) =>
                            updateRule(i, {
                              ...rule,
                              action: v as "did" | "did_not",
                            })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="did">Did</SelectItem>
                            <SelectItem value="did_not">Didn't do</SelectItem>
                          </SelectContent>
                        </Select>

                        <EventCombobox
                          projectId={projectId}
                          value={rule.event_name ?? ""}
                          onChange={(val) => updateRule(i, { ...rule, event_name: val })}
                          placeholder="Select event..."
                          environment={environment}
                          className="w-44"
                        />

                        <Select
                          value={rule.op ?? "gte"}
                          onValueChange={(v) => updateRule(i, { ...rule, op: v })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EVENT_OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          min={0}
                          value={rule.count ?? 1}
                          onChange={(e) =>
                            updateRule(i, {
                              ...rule,
                              count: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-20"
                          placeholder="Count"
                        />

                        <Select
                          value={getTimeWindowType(rule)}
                          onValueChange={(v) => {
                            if (v === "ever") {
                              updateRule(i, {
                                ...rule,
                                time_window: { type: "ever" },
                              });
                            } else {
                              updateRule(i, { ...rule, time_window: "30d" });
                            }
                          }}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_WINDOW_TYPES.map((tw) => (
                              <SelectItem key={tw.value} value={tw.value}>
                                {tw.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {getTimeWindowType(rule) === "relative" && (
                          <>
                            <span className="text-xs text-muted-foreground">in</span>
                            <Input
                              value={getTimeWindowValue(rule)}
                              onChange={(e) =>
                                updateRule(i, { ...rule, time_window: e.target.value })
                              }
                              className="w-20"
                              placeholder="e.g. 30d"
                            />
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={rule.source ?? "user"}
                          onValueChange={(v) =>
                            updateRule(i, {
                              ...rule,
                              source: v as "user" | "event",
                            })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.property || undefined}
                          onValueChange={(v) =>
                            updateRule(i, { ...rule, property: v })
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="Select property..." />
                          </SelectTrigger>
                          <SelectContent>
                            {propertyKeys.map((pk) => (
                              <SelectItem key={pk} value={pk}>
                                {pk}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.op ?? "eq"}
                          onValueChange={(v) => updateRule(i, { ...rule, op: v })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROPERTY_OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {rule.op !== "exists" && (
                          <Input
                            value={rule.value ?? ""}
                            onChange={(e) =>
                              updateRule(i, { ...rule, value: e.target.value })
                            }
                            className="w-40"
                            placeholder="Value"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRule(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add rule button */}
      <button
        type="button"
        onClick={addRule}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/20 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Add Rule
      </button>
    </div>
  );
}
