"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet } from "@/components/ui/sheet";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassNav } from "@/components/ui/glass-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Inbox } from "lucide-react";

export default function StyleguidePage() {
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState("tab-1");
  const demoTabs = [
    { id: "tab-1", label: "Overview" },
    { id: "tab-2", label: "Security" },
    { id: "tab-3", label: "Billing" },
  ];

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Sticky Glass Nav Bar */}
      <GlassNav />

      <main className="mx-auto max-w-7xl px-6 py-12 flex flex-col gap-12">
        {/* Intro Section */}
        <div className="flex flex-col gap-2 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-32 font-semibold tracking-tight text-text">
              Design System Styleguide
            </h1>
            <ThemeToggle />
          </div>
          <p className="text-15 text-muted max-w-[600px]">
            A reference page showcasing our Apple-grade minimalist primitives, color variables, borders, and interactive components.
          </p>
        </div>

        {/* CSS Color Tokens */}
        <section className="flex flex-col gap-4">
          <h2 className="text-20 font-semibold tracking-tight text-text">CSS Color Tokens</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-12 bg-bg border border-border" />
              <span className="text-13 font-medium text-text">--bg</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-12 bg-surface border border-border" />
              <span className="text-13 font-medium text-text">--surface</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-12 bg-raised border border-border" />
              <span className="text-13 font-medium text-text">--raised</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-12 bg-text border border-border" />
              <span className="text-13 font-medium text-text">--text</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-12 bg-muted border border-border" />
              <span className="text-13 font-medium text-text">--muted</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-12 border border-border" />
              <span className="text-13 font-medium text-text">--border</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-12 bg-accent border border-border" />
              <span className="text-13 font-medium text-text">--accent</span>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="flex flex-col gap-4">
          <h2 className="text-20 font-semibold tracking-tight text-text">Buttons</h2>
          <Card className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="destructive">Destructive Button</Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
              <Button size="sm">Small (sm)</Button>
              <Button size="md">Medium (md)</Button>
              <Button size="lg">Large (lg)</Button>
            </div>
          </Card>
        </section>

        {/* Cards */}
        <section className="flex flex-col gap-4">
          <h2 className="text-20 font-semibold tracking-tight text-text">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="flat">
              <h3 className="text-17 font-semibold text-text mb-2">Flat Card</h3>
              <p className="text-13 text-muted">
                Flat background matching the --surface color. Designed for content blocks and dashboard statistics.
              </p>
            </Card>
            <Card variant="raised" hoverable>
              <h3 className="text-17 font-semibold text-text mb-2">Raised Card (Hoverable)</h3>
              <p className="text-13 text-muted">
                Slightly offset background matching the --raised color. Translates up 2px on hover.
              </p>
            </Card>
          </div>
        </section>

        {/* Inputs */}
        <section className="flex flex-col gap-4">
          <h2 className="text-20 font-semibold tracking-tight text-text">Form Elements</h2>
          <Card className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-13 font-semibold text-text">Input Field</label>
                <Input placeholder="Enter username..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-13 font-semibold text-text">Disabled Input</label>
                <Input placeholder="Disabled text..." disabled />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-13 font-semibold text-text">Textarea</label>
              <Textarea placeholder="Type your comment or bio..." />
            </div>
          </Card>
        </section>

        {/* Modals & Sheets */}
        <section className="flex flex-col gap-4">
          <h2 className="text-20 font-semibold tracking-tight text-text">Modals & Sheets (Glass Primitives)</h2>
          <Card className="flex flex-wrap items-center gap-4">
            <Button onClick={() => setModalOpen(true)}>Open Centered Modal</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open Side Sheet</Button>
            <Button variant="secondary" onClick={() => setBottomSheetOpen(true)}>Open Bottom Sheet</Button>

            {/* Modal */}
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Sample Modal">
              <p className="text-15 text-muted mb-6">
                This is a centered dialog card. It uses our system glass styling recipe, including standard borders and backdrop-filter options.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button onClick={() => setModalOpen(false)}>Acknowledge</Button>
              </div>
            </Modal>

            {/* Side Sheet */}
            <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} side="right" title="Side Navigation">
              <div className="flex flex-col gap-4">
                <p className="text-13 text-muted leading-relaxed">
                  Sheets are ideal for detail panes, comments threads, or nested platform filters.
                </p>
                <div className="flex flex-col gap-2 mt-4">
                  <Button size="sm" className="w-full justify-start">Settings Option</Button>
                  <Button size="sm" variant="secondary" className="w-full justify-start">Logout Action</Button>
                </div>
              </div>
            </Sheet>

            {/* Bottom Sheet */}
            <Sheet isOpen={bottomSheetOpen} onClose={() => setBottomSheetOpen(false)} side="bottom" title="Quick Panel">
              <div className="max-w-md mx-auto flex flex-col gap-4 pt-4">
                <p className="text-15 text-muted">
                  Slides up from the bottom. Perfect for mobile configuration selections and prompt templates.
                </p>
                <Button className="w-full mt-4" onClick={() => setBottomSheetOpen(false)}>Dismiss Panel</Button>
              </div>
            </Sheet>
          </Card>
        </section>

        {/* Avatars & Badges */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-20 font-semibold tracking-tight text-text">Avatars</h2>
            <Card className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <Avatar size="sm" fallback="Jane Doe" />
                <span className="text-13 text-muted">Small (sm)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar size="md" fallback="Priyanshu Singh" />
                <span className="text-13 text-muted">Medium (md)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar size="lg" fallback="Owner Acc" />
                <span className="text-13 text-muted">Large (lg)</span>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-20 font-semibold tracking-tight text-text">Badges</h2>
            <Card className="flex flex-wrap items-center gap-3">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="accent">Accent</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </Card>
          </div>
        </section>

        {/* Interactive Tabs */}
        <section className="flex flex-col gap-4">
          <h2 className="text-20 font-semibold tracking-tight text-text">Interactive Tabs</h2>
          <Card className="flex flex-col gap-6">
            <Tabs tabs={demoTabs} activeTab={activeTab} onChange={(id) => setActiveTab(id)} />
            <div className="p-4 rounded-12 bg-raised border border-border">
              <p className="text-15 text-text">
                Currently showing content for: <strong className="text-accent">{demoTabs.find((t) => t.id === activeTab)?.label}</strong>
              </p>
            </div>
          </Card>
        </section>

        {/* Toast Notifications */}
        <section className="flex flex-col gap-4">
          <h2 className="text-20 font-semibold tracking-tight text-text">Toast Notifications</h2>
          <Card className="flex flex-wrap items-center gap-4">
            <Button variant="secondary" onClick={() => toast("Operation completed successfully!", "success")}>
              Trigger Success Toast
            </Button>
            <Button variant="secondary" onClick={() => toast("Error establishing session.", "error")}>
              Trigger Error Toast
            </Button>
            <Button variant="secondary" onClick={() => toast("Note: Session will expire in 2 hours.", "info")}>
              Trigger Info Toast
            </Button>
          </Card>
        </section>

        {/* Skeletons & Empty State */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-20 font-semibold tracking-tight text-text">Skeletons (Loading State)</h2>
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-20 w-full" />
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-20 font-semibold tracking-tight text-text">Empty States</h2>
            <EmptyState
              icon={Inbox}
              title="No drafts found"
              description="Write something original or sketch an idea. Drafts will appear here until published."
              action={<Button size="sm">Create Post</Button>}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
