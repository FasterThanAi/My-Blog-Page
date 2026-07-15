import * as React from "react";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "accent" | "destructive" | "success";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const baseClass =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-13 font-medium border select-none";

  const variants = {
    default: "bg-surface border-border text-text",
    secondary: "bg-raised border-border text-muted",
    accent: "bg-accent/10 border-accent/20 text-accent",
    destructive: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
    success: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
  };

  return (
    <span
      className={twMerge(baseClass, variants[variant], className)}
      {...props}
    />
  );
}
