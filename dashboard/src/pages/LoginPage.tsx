import { useEffect } from "react";
import { useNavigate } from "react-router";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "motion/react";

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();

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
      <div className="flex h-screen items-center justify-center bg-[#F8EDEB]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#081c15]" />
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
      {/* Subtle decorative shapes */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #FEC89A 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #D8E2DC 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Logo */}
        <motion.span
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-2 text-[2rem] font-bold tracking-[0.08em] bg-gradient-to-r from-[#081c15] to-[#52b788] bg-clip-text text-transparent"
          style={{ fontFamily: "'Chillax', sans-serif" }}
        >
          truesight
        </motion.span>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-6 text-sm text-[#081c15]/50 tracking-wide"
        ></motion.p>

        {/* Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mb-8 w-full"
        >
          <img
            src="/images/analytics-hero.png"
            alt="Analytics dashboard illustration"
            className="mx-auto w-full max-w-[360px] drop-shadow-lg"
          />
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
          className="w-full rounded-2xl border border-white/60 bg-white/70 px-8 py-8 shadow-xl shadow-[#FEC5BB]/20 backdrop-blur-sm"
        >
          <h1 className="text-center text-xl font-semibold tracking-tight text-[#081c15]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-center text-sm text-[#081c15]/45">
            Sign in to your account to continue
          </p>

          <div className="mt-7 flex justify-center">
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

          <p className="mt-6 text-center text-[11px] text-[#081c15]/30"></p>
        </motion.div>
      </div>
    </div>
  );
}
