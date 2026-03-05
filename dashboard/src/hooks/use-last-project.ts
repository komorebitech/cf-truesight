import { useCallback } from "react";

const STORAGE_KEY = "truesight_last_project";

export function useLastProject() {
  const lastProjectId = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();

  const setLastProject = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const clearLastProject = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { lastProjectId, setLastProject, clearLastProject };
}
