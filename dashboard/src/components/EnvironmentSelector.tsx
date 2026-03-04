import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EnvironmentSelectorProps {
  value: "live" | "test";
  onChange: (env: "live" | "test") => void;
}

export function EnvironmentSelector({ value, onChange }: EnvironmentSelectorProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as "live" | "test")}>
      <TabsList>
        <TabsTrigger value="live">Live</TabsTrigger>
        <TabsTrigger value="test">Test</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
