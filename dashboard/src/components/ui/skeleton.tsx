import { cn } from "@/lib/utils";

const variantStyles: Record<string, string> = {
  default: "rounded-md",
  text: "h-4 rounded-sm",
  heading: "h-6 rounded-sm",
  avatar: "rounded-full",
  card: "rounded-xl border border-border",
  button: "h-9 rounded-md",
  input: "h-10 rounded-md",
};

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantStyles;
  shimmer?: boolean;
}

function Skeleton({
  className,
  variant = "default",
  shimmer = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        variantStyles[variant],
        !shimmer && "animate-pulse",
        className,
      )}
      {...props}
    >
      {shimmer && (
        <div className="absolute inset-0 -translate-x-full animate-skeleton-wave bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
      )}
    </div>
  );
}

interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

function SkeletonText({ lines = 3, className, ...props }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(i === lines - 1 ? "w-3/4" : "w-full")}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

function SkeletonAvatar({
  size = "md",
  className,
  ...props
}: SkeletonAvatarProps) {
  const sizeStyles: Record<string, string> = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  return (
    <Skeleton
      variant="avatar"
      className={cn(sizeStyles[size], className)}
      {...props}
    />
  );
}

export { Skeleton, SkeletonText, SkeletonAvatar };
