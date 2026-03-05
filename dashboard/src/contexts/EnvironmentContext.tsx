import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type Environment = "live" | "test";

interface EnvironmentContextValue {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
}

const STORAGE_KEY = "truesight_environment";

function getStoredEnv(): Environment {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "test") return "test";
  } catch {
    // ignore
  }
  return "live";
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvState] = useState<Environment>(getStoredEnv);

  const setEnvironment = useCallback((env: Environment) => {
    setEnvState(env);
    try {
      localStorage.setItem(STORAGE_KEY, env);
    } catch {
      // ignore
    }
  }, []);

  return (
    <EnvironmentContext.Provider value={{ environment, setEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) {
    throw new Error("useEnvironment must be used within EnvironmentProvider");
  }
  return ctx;
}
