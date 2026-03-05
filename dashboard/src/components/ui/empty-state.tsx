import { motion } from "motion/react";
import {
  Search,
  Database,
  Filter,
  AlertCircle,
  CheckCircle,
  FileX,
  Package,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

interface VariantConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  defaultTitle: string;
  defaultDescription: string;
}

const variantConfig: Record<string, VariantConfig> = {
  search: {
    icon: Search,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
    defaultTitle: "No results found",
    defaultDescription: "Try adjusting your search or filters",
  },
  data: {
    icon: Database,
    color: "text-foreground",
    bgColor: "bg-muted",
    defaultTitle: "No data available",
    defaultDescription: "There is no data to display at this time",
  },
  filter: {
    icon: Filter,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    defaultTitle: "No matching results",
    defaultDescription: "Try broadening your filter criteria",
  },
  error: {
    icon: AlertCircle,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    defaultTitle: "Something went wrong",
    defaultDescription: "We encountered an error loading this data",
  },
  success: {
    icon: CheckCircle,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    defaultTitle: "All done",
    defaultDescription: "No pending items to show",
  },
  empty: {
    icon: FileX,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    defaultTitle: "Nothing here yet",
    defaultDescription: "Get started by adding your first item",
  },
  package: {
    icon: Package,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    defaultTitle: "No items",
    defaultDescription: "There are no items to display",
  },
};

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

interface EmptyStateProps {
  className?: string;
  variant?: keyof typeof variantConfig;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  icon?: LucideIcon;
  compact?: boolean;
}

function EmptyState({
  variant = "data",
  title,
  description,
  action,
  secondaryAction,
  icon: CustomIcon,
  className,
  compact = false,
}: EmptyStateProps) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const config = (variantConfig[variant] ?? variantConfig.data)!;
  const Icon = CustomIcon || config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{
          duration: 3,
          ease: "easeInOut",
          repeat: Infinity,
        }}
        className={cn(
          "mb-4 flex items-center justify-center rounded-full",
          compact ? "h-12 w-12" : "h-16 w-16",
          config.bgColor,
        )}
      >
        <Icon
          className={cn(config.color, compact ? "h-6 w-6" : "h-8 w-8")}
        />
      </motion.div>

      <h3
        className={cn(
          "font-heading font-semibold text-foreground",
          compact ? "text-base" : "text-lg",
        )}
      >
        {title || config.defaultTitle}
      </h3>

      {(description || config.defaultDescription) && (
        <p
          className={cn(
            "mt-1 max-w-sm text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description || config.defaultDescription}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className={cn("flex items-center gap-3", compact ? "mt-4" : "mt-6")}>
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
              size={compact ? "sm" : "default"}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              size={compact ? "sm" : "default"}
              className="text-muted-foreground"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export { EmptyState, variantConfig };
