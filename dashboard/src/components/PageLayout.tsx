import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  children: ReactNode;
  /** Use false to omit vertical spacing between children (e.g. tabbed pages). Default true. */
  spacing?: boolean;
}

export function PageLayout({ title, children, spacing = true }: PageLayoutProps) {
  return (
    <div className="flex flex-1 flex-col">
      <Header title={title} />
      <div className={cn("flex-1 p-6", spacing && "space-y-6")}>
        {children}
      </div>
    </div>
  );
}
