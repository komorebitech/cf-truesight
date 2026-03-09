import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn("flex-1 px-8 pt-2 pb-8", spacing && "space-y-6")}
      >
        {children}
      </motion.div>
    </div>
  );
}
