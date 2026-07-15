import * as React from "react";
import { twMerge } from "tailwind-merge";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={twMerge(
          "w-full h-[44px] px-4 rounded-12 bg-surface border border-border text-text placeholder:text-muted/60 text-15 focus-ring transition-all outline-none disabled:opacity-50 disabled:pointer-events-none",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
