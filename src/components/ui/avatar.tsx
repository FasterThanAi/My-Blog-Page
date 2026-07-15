"use client";

import * as React from "react";
import { twMerge } from "tailwind-merge";

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({
  src,
  alt = "",
  fallback = "",
  size = "md",
  className,
}: AvatarProps) {
  const [error, setError] = React.useState(false);
  const [prevSrc, setPrevSrc] = React.useState<string | null | undefined>(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setError(false);
  }

  const sizes = {
    sm: "w-8 h-8 text-13",
    md: "w-11 h-11 text-15", // tap target >= 44px friendly
    lg: "w-16 h-16 text-20",
  };

  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(fallback || alt);

  return (
    <div
      className={twMerge(
        "relative flex items-center justify-center rounded-full overflow-hidden bg-raised border border-border select-none shrink-0 font-medium text-muted",
        sizes[size],
        className
      )}
    >
      {src && !error ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </div>
  );
}
