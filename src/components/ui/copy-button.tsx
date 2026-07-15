"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./button";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fail silently
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 h-8 w-8 p-0 bg-surface/50 border border-border hover:bg-surface select-none cursor-pointer"
      aria-label={copied ? "Copied code" : "Copy code"}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted" />}
    </Button>
  );
}
