"use client";

import { Menu } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ThreadSidebar } from "@/components/studio/thread-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

// For demo purposes, we'll use a hardcoded shop ID
// In production, this would come from authentication or URL params
const DEMO_SHOP_ID = "j971661b007fktwgrkh3zxd3p9804eej" as Id<"shops">;

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const selectedThreadId = params?.threadId as Id<"threads"> | undefined;

  const handleSelectThread = (threadId: Id<"threads">) => {
    router.push(`/studio/${threadId}`);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[320px] shrink-0 border-r border-border">
        <ThreadSidebar
          shopId={DEMO_SHOP_ID}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
        />
      </aside>

      {/* Mobile Sidebar */}
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

      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col min-w-0 overflow-hidden")}>
        {children}
      </main>
    </div>
  );
}
