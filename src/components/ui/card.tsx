import * as React from "react";
import { twMerge } from "tailwind-merge";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  variant?: "flat" | "raised";
}

export function Card({
  className,
  hoverable = false,
  variant = "flat",
  ...props
}: CardProps) {
  const baseClass = "rounded-16 border border-border p-6 transition-all duration-200";
  const bgVariant = variant === "flat" ? "bg-surface" : "bg-raised";
  const hoverClass = hoverable
    ? "hover:-translate-y-[2px] cursor-pointer"
    : "";

  return (
    <div
      className={twMerge(baseClass, bgVariant, hoverClass, className)}
      {...props}
    />
  );
}
