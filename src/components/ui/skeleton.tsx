import * as React from "react";
import { twMerge } from "tailwind-merge";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        "animate-pulse rounded-8 bg-border/80 dark:bg-border/60",
        className
      )}
      {...props}
    />
  );
}
