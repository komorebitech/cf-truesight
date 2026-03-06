import type { SegmentDefinition, SegmentRule } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventCombobox } from "@/components/EventCombobox";
import { X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Match</span>
        <Tabs value={operator} onValueChange={setOperator}>
          <TabsList>
            <TabsTrigger value="and">All rules (AND)</TabsTrigger>
            <TabsTrigger value="or">Any rule (OR)</TabsTrigger>
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
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="mt-1 shrink-0">
                      {i + 1}
                    </Badge>

                    <div className="flex-1 space-y-2">
                      {/* Type toggle */}
                      <Tabs
                        value={rule.type}
                        onValueChange={(v) => switchRuleType(i, v as "event" | "property")}
                      >
                        <TabsList className="h-8">
                          <TabsTrigger value="event" className="text-xs">
                            Event
                          </TabsTrigger>
                          <TabsTrigger value="property" className="text-xs">
                            Property
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      {rule.type === "event" ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Did / Didn't do toggle */}
                            <Select
                              value={rule.action ?? "did"}
                              onChange={(e) =>
                                updateRule(i, {
                                  ...rule,
                                  action: e.target.value as "did" | "did_not",
                                })
                              }
                              className="w-28"
                            >
                              <option value="did">Did</option>
                              <option value="did_not">Didn't do</option>
                            </Select>

                            {/* Event name */}
                            <EventCombobox
                              projectId={projectId}
                              value={rule.event_name ?? ""}
                              onChange={(val) => updateRule(i, { ...rule, event_name: val })}
                              placeholder="Select event..."
                              environment={environment}
                              className="w-44"
                            />

                            {/* Operator */}
                            <Select
                              value={rule.op ?? "gte"}
                              onChange={(e) => updateRule(i, { ...rule, op: e.target.value })}
                              className="w-32"
                            >
                              {EVENT_OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </Select>

                            {/* Count */}
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

                            {/* Time window type */}
                            <Select
                              value={getTimeWindowType(rule)}
                              onChange={(e) => {
                                const twType = e.target.value;
                                if (twType === "ever") {
                                  updateRule(i, {
                                    ...rule,
                                    time_window: { type: "ever" },
                                  });
                                } else {
                                  updateRule(i, { ...rule, time_window: "30d" });
                                }
                              }}
                              className="w-36"
                            >
                              {TIME_WINDOW_TYPES.map((tw) => (
                                <option key={tw.value} value={tw.value}>
                                  {tw.label}
                                </option>
                              ))}
                            </Select>

                            {/* Time window value (only for relative) */}
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
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Source */}
                          <Select
                            value={rule.source ?? "user"}
                            onChange={(e) =>
                              updateRule(i, {
                                ...rule,
                                source: e.target.value as "user" | "event",
                              })
                            }
                            className="w-28"
                          >
                            <option value="user">User</option>
                            <option value="event">Event</option>
                          </Select>

                          {/* Property name */}
                          <Select
                            value={rule.property ?? ""}
                            onChange={(e) =>
                              updateRule(i, { ...rule, property: e.target.value })
                            }
                            className="w-44"
                          >
                            <option value="">Select property...</option>
                            {propertyKeys.map((pk) => (
                              <option key={pk} value={pk}>
                                {pk}
                              </option>
                            ))}
                          </Select>

                          {/* Operator */}
                          <Select
                            value={rule.op ?? "eq"}
                            onChange={(e) => updateRule(i, { ...rule, op: e.target.value })}
                            className="w-32"
                          >
                            {PROPERTY_OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </Select>

                          {/* Value (hidden for "exists") */}
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
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add rule button */}
      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-3 w-3" />
        Add Rule
      </Button>
    </div>
  );
}
