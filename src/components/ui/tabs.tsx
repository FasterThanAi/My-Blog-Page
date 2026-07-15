"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

interface Tab {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={twMerge("flex border-b border-border relative select-none", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={twMerge(
              "px-4 py-3 text-15 font-medium relative focus-ring cursor-pointer transition-colors text-muted hover:text-text",
              isActive && "text-text"
            )}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
