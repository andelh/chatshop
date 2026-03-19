"use client";

import { LogOut, Menu, Settings } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ModelSelectorToolbar } from "@/components/studio/model-selector-toolbar";
import { ThreadSidebar } from "@/components/studio/thread-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const DEMO_SHOP_ID = "j971661b007fktwgrkh3zxd3p9804eej" as Id<"shops">;

export function StudioShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSigningOut, startTransition] = useTransition();

  const selectedThreadId = params?.threadId as Id<"threads"> | undefined;

  const handleSelectThread = (threadId: Id<"threads">) => {
    router.push(`/studio/${threadId}`);
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/auth");
      router.refresh();
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden lg:block w-[320px] shrink-0 border-r border-border">
        <ThreadSidebar
          shopId={DEMO_SHOP_ID}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
        />
      </aside>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 z-50"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[320px] p-0">
          <ThreadSidebar
            shopId={DEMO_SHOP_ID}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
          />
        </SheetContent>
      </Sheet>

      <main className={cn("flex-1 flex flex-col min-w-0 overflow-hidden")}>
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
              Studio
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelectorToolbar />
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
