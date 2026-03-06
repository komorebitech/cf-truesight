import { Outlet } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { EnvironmentProvider } from "@/contexts/EnvironmentContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function App() {
  return (
    <EnvironmentProvider>
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
    </EnvironmentProvider>
  );
}
