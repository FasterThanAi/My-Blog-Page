"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";
import { Button } from "./button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  if (!mounted) {
    return (
      <div className="w-[36px] h-[36px] rounded-12 bg-border/20 animate-pulse" />
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className="w-[36px] h-[36px] p-0 flex items-center justify-center"
      aria-label={`Current theme is ${theme}. Click to change.`}
    >
      {theme === "light" && <Sun className="w-4.5 h-4.5 text-text" />}
      {theme === "dark" && <Moon className="w-4.5 h-4.5 text-text" />}
      {theme === "system" && <Laptop className="w-4.5 h-4.5 text-text" />}
    </Button>
  );
}
