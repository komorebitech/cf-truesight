import { Outlet } from "react-router";
import { Sidebar } from "@/components/Sidebar";

export function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
