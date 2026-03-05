import * as React from "react";
import { cn } from "@/lib/utils";

const BASE_INPUT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background text-foreground py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const ICON_CLASSES =
  "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, wrapperClassName, ...props }, ref) => {
    if (!leftIcon && !rightIcon) {
      return (
        <input
          type={type}
          className={cn(BASE_INPUT_CLASSES, "px-3", className)}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <div className={cn("relative", wrapperClassName)}>
        {leftIcon && (
          <span className={cn(ICON_CLASSES, "left-3")}>{leftIcon}</span>
        )}
        <input
          type={type}
          className={cn(
            BASE_INPUT_CLASSES,
            leftIcon ? "!pl-10" : "pl-3",
            rightIcon ? "!pr-10" : "pr-3",
            className,
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <span className={cn(ICON_CLASSES, "right-3")}>{rightIcon}</span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
