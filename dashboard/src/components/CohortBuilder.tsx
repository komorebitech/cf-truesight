import type { CohortDefinition, CohortRule } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface CohortBuilderProps {
  definition: CohortDefinition;
  onChange: (def: CohortDefinition) => void;
  eventNames: string[];
  propertyKeys: string[];
}

function makeDefaultEventRule(): CohortRule {
  return { type: "event", event_name: "", op: "gte", count: 1, time_window: "30d" };
}

function makeDefaultPropertyRule(): CohortRule {
  return { type: "property", property: "", op: "eq", value: "" };
}

export function CohortBuilder({
  definition,
  onChange,
  eventNames,
  propertyKeys,
}: CohortBuilderProps) {
  const { operator, rules } = definition;

  const setOperator = (op: string) => {
    onChange({ ...definition, operator: op as "and" | "or" });
  };

  const updateRule = (index: number, updated: CohortRule) => {
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

  return (
    <div className="space-y-4">
      {/* AND / OR toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Match
        </span>
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
                    {/* Rule number badge */}
                    <Badge variant="secondary" className="mt-1 shrink-0">
                      {i + 1}
                    </Badge>

                    <div className="flex-1 space-y-2">
                      {/* Type toggle */}
                      <Tabs
                        value={rule.type}
                        onValueChange={(v) =>
                          switchRuleType(i, v as "event" | "property")
                        }
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
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Event name */}
                          <Select
                            value={rule.event_name ?? ""}
                            onChange={(e) =>
                              updateRule(i, { ...rule, event_name: e.target.value })
                            }
                            className="w-44"
                          >
                            <option value="">Select event...</option>
                            {eventNames.map((en) => (
                              <option key={en} value={en}>
                                {en}
                              </option>
                            ))}
                          </Select>

                          {/* Operator */}
                          <Select
                            value={rule.op ?? "gte"}
                            onChange={(e) =>
                              updateRule(i, { ...rule, op: e.target.value })
                            }
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

                          {/* Time window */}
                          <span className="text-xs text-muted-foreground">in</span>
                          <Input
                            value={rule.time_window ?? "30d"}
                            onChange={(e) =>
                              updateRule(i, { ...rule, time_window: e.target.value })
                            }
                            className="w-20"
                            placeholder="e.g. 30d"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
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
                            onChange={(e) =>
                              updateRule(i, { ...rule, op: e.target.value })
                            }
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
