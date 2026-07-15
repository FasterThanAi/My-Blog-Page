"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-12 transition-colors focus-ring cursor-pointer disabled:pointer-events-none disabled:opacity-50 select-none";

    const variants = {
      primary: "bg-accent text-white hover:opacity-95 active:opacity-90",
      secondary: "bg-surface border border-border text-text hover:bg-bg active:bg-surface/50",
      ghost: "text-muted hover:text-text hover:bg-border/30 active:bg-border/50",
      destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
    };

    const sizes = {
      sm: "h-[36px] px-3 text-13",
      md: "h-[44px] px-4 text-15",
      lg: "h-[52px] px-6 text-17",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
        className={twMerge(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
