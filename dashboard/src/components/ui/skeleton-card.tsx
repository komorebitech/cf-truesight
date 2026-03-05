import { motion } from "motion/react";
import { Skeleton, SkeletonText } from "./skeleton";
import { cn } from "@/lib/utils";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
  showImage?: boolean;
  lines?: number;
  index?: number;
}

function SkeletonCard({
  showAvatar = false,
  showImage = false,
  lines = 3,
  className,
  index = 0,
}: SkeletonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.08,
        duration: 0.35,
        ease: easeOutExpo,
      }}
      className={cn(
        "space-y-4 rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      {showImage && <Skeleton className="h-32 w-full rounded-lg" />}
      <div className="flex items-start gap-3">
        {showAvatar && (
          <Skeleton variant="avatar" className="h-10 w-10 shrink-0" />
        )}
        <div className="flex-1 space-y-2">
          <Skeleton variant="heading" className="w-2/3" />
          <SkeletonText lines={lines} />
        </div>
      </div>
    </motion.div>
  );
}

interface SkeletonCardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
  showAvatar?: boolean;
  showImage?: boolean;
  lines?: number;
}

function SkeletonCardGrid({
  count = 4,
  columns = 2,
  showAvatar = false,
  showImage = false,
  lines = 2,
  className,
  ...props
}: SkeletonCardGridProps) {
  const gridCols: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      className={cn("grid gap-4", gridCols[columns], className)}
      {...props}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard
          key={`skeleton-card-${index}`}
          index={index}
          showAvatar={showAvatar}
          showImage={showImage}
          lines={lines}
        />
      ))}
    </div>
  );
}

export { SkeletonCard, SkeletonCardGrid };
