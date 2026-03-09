import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { completeOnboarding } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoachmarkStep {
  /** CSS selector for the target element to spotlight */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description body */
  body: string;
  /** Preferred placement of tooltip relative to target */
  placement?: "top" | "bottom" | "left" | "right";
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Coachmark steps for new users
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS: CoachmarkStep[] = [
  {
    target: "[data-coachmark='sidebar-nav']",
    title: "Your command center",
    body: "Navigate between dashboards, events, insights, and settings from here. Each icon opens a detailed menu.",
    placement: "right",
  },
  {
    target: "[data-coachmark='project-overview']",
    title: "Project at a glance",
    body: "This is your project home — key metrics, event throughput, and active users all in one place.",
    placement: "bottom",
  },
  {
    target: "[data-coachmark='project-switcher']",
    title: "Switch projects",
    body: "Working on multiple apps? Jump between projects instantly from this dropdown.",
    placement: "right",
  },
  {
    target: "[data-coachmark='env-toggle']",
    title: "Live or test?",
    body: "Toggle between your production and test environments. Test events stay separate so you can experiment freely.",
    placement: "right",
  },
  {
    target: "[data-coachmark='events-nav']",
    title: "Explore your data",
    body: "Browse, search, and filter every event flowing into your project. See what's happening in real time.",
    placement: "right",
  },
  {
    target: "[data-coachmark='insights-nav']",
    title: "Uncover patterns",
    body: "Trends, funnels, pivots, and more — slice your data to find what matters. This is where insights live.",
    placement: "right",
  },
  {
    target: "[data-coachmark='theme-toggle']",
    title: "Make it yours",
    body: "Switch between light and dark mode anytime. Your preference is saved automatically.",
    placement: "right",
  },
];

// ---------------------------------------------------------------------------
// Spotlight overlay + tooltip
// ---------------------------------------------------------------------------

function getTooltipPosition(
  rect: SpotlightRect,
  placement: CoachmarkStep["placement"] = "bottom",
  tooltipWidth: number,
  tooltipHeight: number,
) {
  const pad = 16;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "right":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left + rect.width + pad;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - pad;
      break;
    case "top":
      top = rect.top - tooltipHeight - pad;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "bottom":
    default:
      top = rect.top + rect.height + pad;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
  }

  // Clamp to viewport
  top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

  return { top, left };
}

function SpotlightOverlay({
  rect,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: {
  rect: SpotlightRect;
  step: CoachmarkStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ w: 320, h: 200 });

  useEffect(() => {
    if (tooltipRef.current) {
      const { offsetWidth, offsetHeight } = tooltipRef.current;
      setTooltipSize({ w: offsetWidth, h: offsetHeight });
    }
  }, [step]);

  const pos = getTooltipPosition(rect, step.placement, tooltipSize.w, tooltipSize.h);
  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  // SVG mask to create spotlight cutout
  const padding = 8;
  const borderRadius = 12;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
          className="transition-all duration-300"
        />
      </svg>

      {/* Spotlight ring */}
      <motion.div
        className="absolute rounded-xl ring-2 ring-[#FEC89A]/60 pointer-events-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />

      {/* Tooltip */}
      <motion.div
        ref={tooltipRef}
        key={stepIndex}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        className="absolute z-[10000] w-80 rounded-xl bg-card p-5 shadow-2xl ring-1 ring-border"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Content */}
        <h3
          className="text-sm font-semibold text-foreground pr-6"
          style={{ fontFamily: "'Chillax', sans-serif" }}
        >
          {step.title}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        {/* Footer: progress + nav */}
        <div className="mt-4 flex items-center justify-between">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === stepIndex
                    ? "w-4 bg-[#2d6a4f]"
                    : i < stepIndex
                      ? "w-1.5 bg-[#2d6a4f]/40"
                      : "w-1.5 bg-muted-foreground/20",
                )}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-1 rounded-lg bg-[#2d6a4f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#245a42] transition-colors"
            >
              {isLast ? "Get started" : "Next"}
              {!isLast && <ArrowRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding provider
// ---------------------------------------------------------------------------

export function OnboardingCoachmarks() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [active, setActive] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  // Only show for authenticated users who haven't completed onboarding
  useEffect(() => {
    if (user && !user.onboarding_completed_at) {
      // Small delay so the UI renders first
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Find and track the target element
  useEffect(() => {
    if (!active) return;

    const step = ONBOARDING_STEPS[currentStep];
    if (!step) return;

    let skipped = false;
    const updateRect = () => {
      if (skipped) return;
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setSpotlightRect({
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          });
          return;
        }
      }
      // Target not found or not visible — auto-skip after a brief wait
      skipped = true;
      setSpotlightRect(null);
      setTimeout(() => setCurrentStep((s) => Math.min(s + 1, ONBOARDING_STEPS.length - 1)), 50);
    };

    updateRect();
    // Re-measure on scroll/resize
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, currentStep]);

  const handleComplete = useCallback(async () => {
    setActive(false);
    try {
      await completeOnboarding();
    } catch {
      // Silently fail — UX shouldn't break if API is unreachable
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const currentStepData = ONBOARDING_STEPS[currentStep];
  if (!active || !spotlightRect || !currentStepData) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      <SpotlightOverlay
        rect={spotlightRect}
        step={currentStepData}
        stepIndex={currentStep}
        totalSteps={ONBOARDING_STEPS.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleComplete}
      />
    </AnimatePresence>,
    document.body,
  );
}
