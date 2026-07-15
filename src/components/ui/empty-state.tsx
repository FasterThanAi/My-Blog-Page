import * as React from "react";
import { LucideIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        "flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-16 bg-surface/50 select-none",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 p-3 rounded-full bg-raised border border-border">
          <Icon className="w-8 h-8 text-muted" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-17 font-semibold text-text mb-1">{title}</h3>
      <p className="text-13 text-muted max-w-[320px] mb-6 leading-normal">
        {description}
      </p>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}
