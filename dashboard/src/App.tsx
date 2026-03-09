import { useEffect, useRef } from "react";
import { Outlet } from "react-router";
import { useIsFetching } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { EnvironmentProvider } from "@/contexts/EnvironmentContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingCoachmarks } from "@/components/Coachmark";

/**
 * YouTube/GitHub-style progress bar.
 * Always mounted (no conditional render) — visibility controlled via opacity.
 * Phases: idle → loading (0→85% ease-out) → finishing (→100% fast) → fade out → idle.
 */
function GlobalProgressBar() {
  const isFetching = useIsFetching();
  const isFetchingBool = isFetching > 0;

  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<"idle" | "loading" | "finishing">("idle");
  const progressRef = useRef(0);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    if (isFetchingBool && phaseRef.current === "idle") {
      // Reset and start
      progressRef.current = 0;
      bar.style.transition = "none";
      bar.style.width = "0%";
      bar.style.opacity = "1";
      phaseRef.current = "loading";

      const tick = () => {
        const p = progressRef.current;

        if (phaseRef.current === "loading") {
          progressRef.current = p + (85 - p) * 0.02;
        } else if (phaseRef.current === "finishing") {
          progressRef.current = p + (100 - p) * 0.15;

          if (progressRef.current >= 99.8) {
            bar.style.width = "100%";
            // Hold at 100%, then fade out
            setTimeout(() => {
              bar.style.transition = "opacity 300ms ease-out";
              bar.style.opacity = "0";
              setTimeout(() => {
                phaseRef.current = "idle";
                progressRef.current = 0;
                bar.style.transition = "none";
                bar.style.width = "0%";
              }, 300);
            }, 150);
            return;
          }
        }

        bar.style.width = `${progressRef.current}%`;
        rafRef.current = requestAnimationFrame(tick);
      };

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    } else if (!isFetchingBool && phaseRef.current === "loading") {
      phaseRef.current = "finishing";
    }
  }, [isFetchingBool]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[2px] overflow-hidden pointer-events-none">
      <div
        ref={barRef}
        className="h-full bg-gradient-to-r from-[#FEC89A] to-[#e07a6a] rounded-full"
        style={{ width: "0%", opacity: 0, willChange: "width, opacity" }}
      />
    </div>
  );
}

export function App() {
  return (
    <EnvironmentProvider>
    <TooltipProvider>
      <GlobalProgressBar />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
      <Toaster />
      <OnboardingCoachmarks />
    </TooltipProvider>
    </EnvironmentProvider>
  );
}
