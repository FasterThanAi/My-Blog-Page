"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  side?: "right" | "bottom";
  children: React.ReactNode;
  className?: string;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  side = "right",
  children,
  className,
}: SheetProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const isRight = side === "right";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet body */}
          <motion.div
            initial={
              isRight
                ? { x: "100%", opacity: 0.9 }
                : { y: "100%", opacity: 0.9 }
            }
            animate={isRight ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 }}
            exit={
              isRight
                ? { x: "100%", opacity: 0.9 }
                : { y: "100%", opacity: 0.9 }
            }
            transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
            className={twMerge(
              "glass-effect z-10 flex flex-col overflow-hidden relative",
              isRight
                ? "h-full w-full max-w-[400px] border-l rounded-l-24"
                : "w-full h-[80vh] border-t rounded-t-24",
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              {title ? (
                <h3 className="text-17 font-semibold text-text">{title}</h3>
              ) : (
                <div />
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-full text-muted hover:text-text hover:bg-border/30 focus-ring cursor-pointer"
                aria-label="Close sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
