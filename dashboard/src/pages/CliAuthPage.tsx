import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { GoogleLogin } from "@react-oauth/google";
import { googleLogin } from "@/lib/api";
import { toast } from "sonner";

type Status = "idle" | "authenticating" | "redirecting" | "success" | "error";

export function CliAuthPage() {
  const [searchParams] = useSearchParams();
  const port = searchParams.get("port");
  const state = searchParams.get("state");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Force light mode for this page
    document.documentElement.classList.remove("dark");
    return () => {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") document.documentElement.classList.add("dark");
    };
  }, []);

  if (!port || !state) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8EDEB]">
        <div className="max-w-md rounded-2xl border border-white/60 bg-white/70 px-8 py-8 text-center shadow-xl backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-[#081c15]">
            Invalid CLI Auth Request
          </h2>
          <p className="mt-2 text-sm text-[#081c15]/50">
            Missing required parameters. Please run{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              truesight auth login
            </code>{" "}
            from your terminal.
          </p>
        </div>
      </div>
    );
  }

  const handleSuccess = async (credential: string) => {
    setStatus("authenticating");
    try {
      const data = await googleLogin(credential);
      setStatus("redirecting");
      // Redirect to the CLI callback server with the JWT
      const callbackUrl = `http://127.0.0.1:${port}/callback?token=${encodeURIComponent(data.token)}&state=${encodeURIComponent(state)}`;
      window.location.href = callbackUrl;

      // Show success after a short delay (user may already be redirected)
      setTimeout(() => setStatus("success"), 1000);
    } catch {
      setStatus("error");
      setErrorMessage("Authentication failed. Please try again.");
      toast.error("Authentication failed");
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(160deg, #F8EDEB 0%, #FAE1DD 30%, #FFE5D9 60%, #FCD5CE 100%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span
            className="text-[1.8rem] font-bold tracking-[0.08em] bg-gradient-to-r from-[#081c15] to-[#52b788] bg-clip-text text-transparent"
            style={{ fontFamily: "'Chillax', sans-serif" }}
          >
            truesight
          </span>
          <p className="mt-1 text-sm text-[#081c15]/40">CLI Authentication</p>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/70 px-8 py-8 shadow-xl shadow-[#FEC5BB]/20 backdrop-blur-sm">
          {status === "idle" && (
            <>
              <h2 className="text-center text-lg font-semibold text-[#081c15]">
                Sign in to TrueSight CLI
              </h2>
              <p className="mt-2 text-center text-sm text-[#081c15]/45">
                Authenticate your terminal session with Google
              </p>
              <div className="mt-6 flex justify-center">
                <GoogleLogin
                  onSuccess={async (response) => {
                    if (!response.credential) {
                      setStatus("error");
                      setErrorMessage("No credential received from Google");
                      return;
                    }
                    await handleSuccess(response.credential);
                  }}
                  onError={() => {
                    setStatus("error");
                    setErrorMessage("Google Sign-In failed");
                  }}
                  theme="outline"
                  size="large"
                  width="320"
                />
              </div>
            </>
          )}

          {status === "authenticating" && (
            <div className="flex flex-col items-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#081c15]" />
              <p className="mt-4 text-sm text-[#081c15]/60">
                Authenticating...
              </p>
            </div>
          )}

          {status === "redirecting" && (
            <div className="flex flex-col items-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d6a4f]" />
              <p className="mt-4 text-sm text-[#081c15]/60">
                Completing authentication...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#081c15]">
                Authentication successful!
              </h3>
              <p className="mt-2 text-sm text-[#081c15]/50">
                You can close this tab and return to your terminal.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#081c15]">
                Authentication failed
              </h3>
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
              <button
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage("");
                }}
                className="mt-4 rounded-lg bg-[#081c15] px-4 py-2 text-sm text-white hover:bg-[#081c15]/90"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
