import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useApiKeys } from "@/hooks/use-api-keys";
import { cn, copyToClipboard } from "@/lib/utils";
import { Check, Copy, Key, Code, Zap, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { fadeInUp } from "@/lib/motion";
import { toast } from "sonner";

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded-md border bg-background p-1 opacity-0 transition-opacity group-hover:opacity-100"
        title="Copy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

const STEPS = [
  { key: "key", label: "Get API Key", icon: Key },
  { key: "sdk", label: "Install SDK", icon: Code },
  { key: "verify", label: "Send Events", icon: Zap },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface SetupGuideProps {
  projectId: string;
}

export function SetupGuide({ projectId }: SetupGuideProps) {
  const navigate = useNavigate();
  const { data: apiKeysData } = useApiKeys(projectId);
  const hasKeys = (apiKeysData?.data?.length ?? 0) > 0;
  const [activeStep, setActiveStep] = useState<StepKey>(hasKeys ? "sdk" : "key");

  // Update active step if keys appear
  const effectiveStep = activeStep === "key" && hasKeys ? "sdk" : activeStep;

  return (
    <motion.div {...fadeInUp} transition={{ duration: 0.4 }}>
      <Card className="border-primary/20 bg-gradient-to-br from-secondary/30 to-accent/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Get started with TrueSight</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Start tracking events in 3 steps
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              Setup
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const isComplete =
                (step.key === "key" && hasKeys);
              const isActive = step.key === effectiveStep;
              const Icon = step.icon;
              return (
                <button
                  key={step.key}
                  onClick={() => setActiveStep(step.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : isComplete
                        ? "border-success/30 bg-success/5 text-success"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  {step.label}
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="ml-1 h-3 w-3 text-muted-foreground/50" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Step content */}
          {effectiveStep === "key" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                API keys authenticate your SDK with this project. Generate a <strong>test</strong> key to get started safely.
              </p>
              <Button
                onClick={() => navigate(`/projects/${projectId}/settings`)}
                size="sm"
              >
                <Key className="h-4 w-4" />
                Go to Settings
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {effectiveStep === "sdk" && <SdkInstallStep />}

          {effectiveStep === "verify" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                After integrating the SDK, trigger a few events and they'll appear in the <strong>Events</strong> tab within seconds.
              </p>
              <CopyBlock
                code={`// The SDK auto-tracks page views.\n// To send a custom event:\nTrueSight.track("button_clicked", {\n  button_name: "signup",\n  page: "/home",\n});`}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/projects/${projectId}/events`)}
                >
                  View Events
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SdkInstallStep() {
  return (
    <Tabs defaultValue="web" className="space-y-3">
      <TabsList>
        <TabsTrigger value="web">Web</TabsTrigger>
        <TabsTrigger value="android">Android</TabsTrigger>
        <TabsTrigger value="ios">iOS</TabsTrigger>
      </TabsList>

      <TabsContent value="web" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Install the Web SDK via npm, then initialize with your API key.
        </p>
        <CopyBlock code="npm install @cityflo/truesight-web-sdk" />
        <CopyBlock
          code={`import TrueSight from "@cityflo/truesight-web-sdk";

TrueSight.init({
  endpoint: "https://truesight.cityflo.net",
  apiKey: "YOUR_API_KEY",
});`}
        />
      </TabsContent>

      <TabsContent value="android" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add the TrueSight KMM dependency to your Android project.
        </p>
        <CopyBlock
          code={`// build.gradle.kts (app module)
dependencies {
    implementation("net.cityflo:truesight-sdk:<version>")
}`}
        />
        <CopyBlock
          code={`// Application.kt
import net.cityflo.truesight.TrueSight

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        TrueSight.init(
            context = this,
            endpoint = "https://truesight.cityflo.net",
            apiKey = "YOUR_API_KEY",
        )
    }
}`}
        />
      </TabsContent>

      <TabsContent value="ios" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add the TrueSight KMM framework via CocoaPods or SPM.
        </p>
        <CopyBlock
          code={`# Podfile
pod 'TrueSightSDK', '~> <version>'`}
        />
        <CopyBlock
          code={`// AppDelegate.swift
import TrueSightSDK

func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: ...
) -> Bool {
    TrueSight.shared.initialize(
        endpoint: "https://truesight.cityflo.net",
        apiKey: "YOUR_API_KEY"
    )
    return true
}`}
        />
      </TabsContent>
    </Tabs>
  );
}

/** Compact SDK snippets for the API key generation dialog */
export function SdkSnippets({ apiKey }: { apiKey: string }) {
  return (
    <Tabs defaultValue="web" className="space-y-3">
      <TabsList>
        <TabsTrigger value="web">Web</TabsTrigger>
        <TabsTrigger value="android">Android</TabsTrigger>
        <TabsTrigger value="ios">iOS</TabsTrigger>
      </TabsList>

      <TabsContent value="web" className="space-y-2">
        <CopyBlock
          code={`import TrueSight from "@cityflo/truesight-web-sdk";

TrueSight.init({
  endpoint: "https://truesight.cityflo.net",
  apiKey: "${apiKey}",
});`}
        />
      </TabsContent>

      <TabsContent value="android" className="space-y-2">
        <CopyBlock
          code={`TrueSight.init(
    context = this,
    endpoint = "https://truesight.cityflo.net",
    apiKey = "${apiKey}",
)`}
        />
      </TabsContent>

      <TabsContent value="ios" className="space-y-2">
        <CopyBlock
          code={`TrueSight.shared.initialize(
    endpoint: "https://truesight.cityflo.net",
    apiKey: "${apiKey}"
)`}
        />
      </TabsContent>
    </Tabs>
  );
}
