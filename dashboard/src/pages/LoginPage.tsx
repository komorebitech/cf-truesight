import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "motion/react";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

// ---------------------------------------------------------------------------
// Blinking "truesight" logo — the dot on the "i" blinks like an eye
// ---------------------------------------------------------------------------

function TruesightLogoBlinking() {
  const [blink, setBlink] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let first = true;
    const scheduleBlink = () => {
      const delay = first ? 1000 : 2000 + Math.random() * 2000;
      first = false;
      timeoutRef.current = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 150);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const fontStyle = {
    fontFamily: "'Chillax', sans-serif",
  } as const;

  return (
    <span
      className="inline-flex items-baseline cursor-default select-none font-bold tracking-[0.08em] text-[#081c15] text-[2.5rem]"
      style={fontStyle}
    >
      trues
      {/* "i" with animated dot — clip off the native dot, overlay our own */}
      <span className="relative inline-block">
        {/* "i" with its dot clipped away */}
        <span style={{ clipPath: "inset(34% 0 0 0)" }}>i</span>
        {/* Animated dot */}
        <span
          className="absolute left-1/2 transition-transform duration-[150ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            top: "0.2em",
            width: "0.2em",
            height: "0.2em",
            borderRadius: "50%",
            background: "#081c15",
            transform: `translateX(-73%) ${blink ? "scaleY(0.15)" : "scaleY(1)"}`,
            transformOrigin: "center bottom",
          }}
        />
      </span>
      ght
    </span>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const TAGLINES = [
  "Your data, distilled.",
  "See what matters.",
  "Clarity in every event.",
  "Insights, not noise.",
];

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const greeting = useMemo(getGreeting, []);
  const tagline = useMemo(
    () => TAGLINES[Math.floor(Math.random() * TAGLINES.length)],
    [],
  );

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    return () => {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") document.documentElement.classList.add("dark");
    };
  }, []);

  if (isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{
          background:
            "linear-gradient(160deg, #F8EDEB 0%, #FAE1DD 30%, #FFE5D9 60%, #FCD5CE 100%)",
        }}
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#081c15]/15 border-t-[#081c15]" />
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
      style={{
        background:
          "linear-gradient(160deg, #F8EDEB 0%, #FAE1DD 30%, #FFE5D9 60%, #FCD5CE 100%)",
      }}
    >
      {/* Floating decorative shapes */}
      <motion.div
        className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #FEC89A 0%, transparent 70%)",
        }}
        animate={{
          y: [0, -18, 0],
          x: [0, 10, 0],
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #D8E2DC 0%, transparent 70%)",
        }}
        animate={{
          y: [0, 14, 0],
          x: [0, -8, 0],
          scale: [1, 1.03, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Third accent blob */}
      <motion.div
        className="pointer-events-none absolute top-1/3 -left-20 h-[300px] w-[300px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, #FEC5BB 0%, transparent 70%)",
        }}
        animate={{
          y: [0, 20, 0],
          x: [0, 12, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_QUART }}
          className="mb-1"
        >
          <TruesightLogoBlinking />
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT_QUART }}
          className="mb-6 text-sm font-medium tracking-wide text-[#081c15]/40"
          style={{ fontFamily: "'Chillax', sans-serif" }}
        >
          {tagline}
        </motion.p>

        {/* Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE_OUT_QUART }}
          className="mb-6 w-full"
        >
          <img
            src="/images/analytics-hero.png"
            alt="Analytics dashboard illustration"
            className="mx-auto w-full max-w-[340px]"
          />
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: EASE_OUT_QUART }}
          whileHover={{
            boxShadow:
              "0 20px 60px -12px rgba(212, 165, 154, 0.3), 0 0 0 1px rgba(8, 28, 21, 0.04)",
          }}
          className="w-full rounded-2xl bg-white/85 px-8 py-8 shadow-xl shadow-[#d4a59a]/15 ring-1 ring-[#081c15]/[0.04] backdrop-blur-sm transition-shadow duration-500"
        >
          <h1
            className="text-center text-xl font-semibold tracking-tight text-[#081c15]"
            style={{ fontFamily: "'Chillax', sans-serif" }}
          >
            {greeting}
          </h1>
          <p className="mt-1.5 text-center text-sm text-[#081c15]/55">
            Sign in to your account to continue
          </p>

          <div className="mt-6 flex justify-center">
            <GoogleLogin
              onSuccess={async (response) => {
                if (!response.credential) {
                  toast.error("No credential received from Google");
                  return;
                }
                try {
                  await login(response.credential);
                  navigate("/", { replace: true });
                } catch {
                  toast.error("Sign in failed. Please try again.");
                }
              }}
              onError={() => {
                toast.error("Google Sign-In failed");
              }}
              theme="outline"
              size="large"
              width="320"
            />
          </div>
        </motion.div>

        {/* Footer detail */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6, ease: EASE_OUT_QUART }}
          className="mt-6 text-xs text-[#081c15]/30"
        >
          Analytics by Cityflo
        </motion.p>
      </div>
    </div>
  );
}
