import { useState, useCallback, useRef } from "react";
import { useParams } from "react-router";
import { motion, useInView } from "motion/react";
import {
  Terminal,
  Copy,
  Check,
  Folder,
  Users,
  BarChart3,
  List,
  Search,
  LineChart,
  RotateCcw,
  Grid3X3,
  GitBranch,
  UserCircle,
  UsersRound,
  Layers,
  LayoutGrid,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";

/* ═══════════════════════════════════════════════════════════════════════════
   CSS KEYFRAMES — injected once
   ═══════════════════════════════════════════════════════════════════════════ */

const ease = [0.25, 0.1, 0.25, 1] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   TERMINAL BLOCK
   ═══════════════════════════════════════════════════════════════════════════ */

function TerminalBlock({
  command,
  label,
  chrome = false,
}: {
  command: string;
  label?: string;
  chrome?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <div>
      {label && (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      )}
      <div className="group relative overflow-hidden rounded-xl bg-[#0d1117] ring-1 ring-white/[0.06]">
        {chrome && (
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5">
            <span className="h-[10px] w-[10px] rounded-full bg-[#ff5f57]" />
            <span className="h-[10px] w-[10px] rounded-full bg-[#febc2e]" />
            <span className="h-[10px] w-[10px] rounded-full bg-[#28c840]" />
            <span className="ml-auto font-mono text-[10px] text-white/20">
              ~/analytics
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 px-5 py-3.5">
          <span className="shrink-0 select-none font-mono text-sm font-semibold text-[#7ee787]">
            $
          </span>
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] leading-7 text-[#e6edf3] scrollbar-none">
            {command}
          </code>
          <button
            onClick={copy}
            className="shrink-0 rounded-md p-1.5 text-white/25 transition-colors hover:bg-white/[0.08] hover:text-white/60 active:scale-95"
            aria-label="Copy command"
          >
            {copied ? (
              <Check className="h-4 w-4 text-[#7ee787]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMAND REFERENCE DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const commands: { name: string; desc: string; icon: LucideIcon }[] = [
  { name: "projects", desc: "Create, list, update & delete projects", icon: Folder },
  { name: "teams", desc: "Members, invitations & domains", icon: Users },
  { name: "stats", desc: "Counts, throughput, active users", icon: BarChart3 },
  { name: "event-catalog", desc: "Browse events and properties", icon: List },
  { name: "properties", desc: "Keys, values & insights", icon: Search },
  { name: "trends", desc: "Time-series analysis", icon: LineChart },
  { name: "retention", desc: "Cohort retention analysis", icon: RotateCcw },
  { name: "pivots", desc: "Multi-dimensional pivots", icon: Grid3X3 },
  { name: "flows", desc: "User flow & path analysis", icon: Workflow },
  { name: "users", desc: "Profiles and user events", icon: UserCircle },
  { name: "segments", desc: "Define & manage segments", icon: UsersRound },
  { name: "cohorts", desc: "Behavioral cohort definitions", icon: Layers },
  { name: "boards", desc: "Dashboards, widgets & layouts", icon: LayoutGrid },
  { name: "funnels", desc: "Conversion funnel analysis", icon: GitBranch },
];

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export function CliPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-1 flex-col">
      <Header title="CLI" />

      <div className="flex-1 overflow-y-auto">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          {/* Subtle gradient wash */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent dark:from-primary/[0.08]" />

          {/* Dot grid texture */}
          <div
            className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-[0.03] dark:opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle, hsl(var(--foreground)) 0.8px, transparent 0.8px)",
              backgroundSize: "20px 20px",
            }}
          />

          <div className="relative mx-auto max-w-3xl px-8 pb-20 pt-14 sm:pt-20">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
            >
              <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.25em] text-primary/60">
                Developer Tools
              </p>
              <h1
                className="text-[clamp(2.8rem,7vw,4.5rem)] font-bold leading-[1] tracking-[-0.03em] text-foreground"
                style={{ fontFamily: "'Chillax', var(--font-heading)" }}
              >
                TrueSight{" "}
                <span className="bg-gradient-to-r from-[#2d6a4f] to-[#52b788] bg-clip-text text-transparent dark:from-[#52b788] dark:to-[#95d5b2]">
                  CLI
                </span>
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Terminal-first analytics for engineers and AI&nbsp;agents.
                Every API endpoint, one command away.
              </p>
            </motion.div>

            {/* Hero terminal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease }}
              className="mt-10"
            >
              <div className="overflow-hidden rounded-xl bg-[#0d1117] ring-1 ring-white/[0.06] shadow-2xl shadow-black/20">
                <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5">
                  <span className="h-[10px] w-[10px] rounded-full bg-[#ff5f57]" />
                  <span className="h-[10px] w-[10px] rounded-full bg-[#febc2e]" />
                  <span className="h-[10px] w-[10px] rounded-full bg-[#28c840]" />
                  <span className="ml-auto font-mono text-[10px] text-white/20">
                    ~/analytics
                  </span>
                </div>
                <div className="px-5 py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-[#7ee787]">$</span>
                    <span className="font-mono text-[13px] text-[#e6edf3]">
                      truesight stats event-count --from 2026-03-01
                    </span>
                  </div>
                  <div className="font-mono text-[12px] leading-6 text-white/40">
                    <span className="text-white/60">total_events</span>
                    {": "}
                    <span className="text-[#79c0ff]">184,291</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── CONTENT ──────────────────────────────────────────── */}
        <div className="mx-auto max-w-3xl space-y-24 px-8 pb-24">

          {/* ── INSTALL ────────────────────────────────────────── */}
          <Section>
            <SectionLabel>Install</SectionLabel>
            <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
              One command. Any platform.
            </h2>
            <TerminalBlock command="curl -fsSL https://truesight.cityflo.net/install.sh | sh" chrome />
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
              Auto-detects your OS and architecture. Installs to{" "}
              <InlineCode>~/.local/bin</InlineCode>. Supports Linux and macOS,
              Intel and Apple&nbsp;Silicon.
            </p>
          </Section>

          {/* ── SETUP ──────────────────────────────────────────── */}
          <Section>
            <SectionLabel>Setup</SectionLabel>
            <h2 className="mb-10 text-2xl font-bold tracking-tight sm:text-3xl">
              Ready in two steps
            </h2>

            {/* Step 1 */}
            <div className="flex gap-5 sm:gap-6">
              <div className="flex flex-col items-center">
                <StepNumber>1</StepNumber>
                <div className="mt-2 w-px flex-1 bg-gradient-to-b from-border to-transparent" />
              </div>
              <div className="min-w-0 flex-1 pb-12">
                <h3 className="mb-1 text-lg font-semibold">Point to the API</h3>
                <p className="mb-5 text-sm text-muted-foreground">
                  Configure once — saved in{" "}
                  <InlineCode>~/.truesight/config.json</InlineCode>
                </p>
                <TerminalBlock command="truesight config set api_url https://ts-admin.cityflo.net" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-5 sm:gap-6">
              <div className="flex flex-col items-center">
                <StepNumber>2</StepNumber>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 text-lg font-semibold">Authenticate</h3>
                <p className="mb-5 text-sm text-muted-foreground">
                  Opens your browser for Google&nbsp;Sign-In. Credentials stored
                  in <InlineCode>~/.truesight/</InlineCode>
                </p>
                <TerminalBlock command="truesight auth login" />
              </div>
            </div>
          </Section>

          {/* ── QUICK START ────────────────────────────────────── */}
          <Section>
            <SectionLabel>Quick Start</SectionLabel>
            <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
              Try with this project
            </h2>
            <div className="space-y-5">
              <TerminalBlock
                label="List all projects"
                command="truesight projects list"
              />
              <TerminalBlock
                label="Event count"
                command={`truesight stats event-count -p ${id} --from 2026-03-01 --to 2026-03-08`}
              />
              <TerminalBlock
                label="Trends query"
                command={`truesight trends query -p ${id} --body '{"event_name":"page_view","from":"2026-03-01","to":"2026-03-08"}'`}
              />
            </div>
          </Section>

          {/* ── COMMAND REFERENCE ──────────────────────────────── */}
          <Section>
            <SectionLabel>Reference</SectionLabel>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Every endpoint, covered
            </h2>
            <p className="mb-8 text-[15px] text-muted-foreground">
              14 command groups with full admin API parity.
              Run <InlineCode>truesight {"<command>"} --help</InlineCode> for details.
            </p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {commands.map((cmd, i) => (
                <CommandCard key={cmd.name} cmd={cmd} index={i} />
              ))}
            </div>
          </Section>

          {/* ── FOOTER TIP ─────────────────────────────────────── */}
          <div className="!mt-14 flex gap-3 rounded-xl border border-border/60 bg-card/60 px-5 py-4">
            <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-primary/50" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Output defaults to <InlineCode>json</InlineCode> for piping and
              AI agents. Add <InlineCode>--format table</InlineCode> for
              human-readable output.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPPORTING COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary/70">
      {children}
    </p>
  );
}

function StepNumber({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-base font-bold text-primary-foreground shadow-lg">
      {children}
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground/80 dark:bg-muted">
      {children}
    </code>
  );
}

function CommandCard({
  cmd,
  index,
}: {
  cmd: { name: string; desc: string; icon: LucideIcon };
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: 0.35,
        delay: index * 0.03,
        ease,
      }}
      className="group flex items-start gap-3 rounded-lg border border-border/50 bg-card/70 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md dark:bg-card/40 dark:hover:bg-card/60"
    >
      <cmd.icon className="mt-[3px] h-[15px] w-[15px] shrink-0 text-primary/50 transition-colors group-hover:text-primary/80" />
      <div className="min-w-0">
        <p className="font-mono text-[13px] font-semibold leading-tight text-foreground/90">
          {cmd.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">
          {cmd.desc}
        </p>
      </div>
    </motion.div>
  );
}
