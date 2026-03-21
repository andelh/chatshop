"use client";

import { useQuery } from "convex/react";
import { LogOut, Menu, Settings } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ModelSelectorToolbar } from "@/components/studio/model-selector-toolbar";
import { ThreadSidebar } from "@/components/studio/thread-sidebar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function StudioShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSigningOut, startTransition] = useTransition();

  const selectedThreadId = params?.threadId as Id<"threads"> | undefined;
  const shopIdParam = searchParams.get("shop");

  const userShops = useQuery(api.shopMembers.listUserShops);
  const currentShop =
    userShops?.find((s) => s._id === shopIdParam) ?? userShops?.[0];
  const currentShopId = currentShop?._id;

  const handleSelectThread = (threadId: Id<"threads">) => {
    const url = new URL(window.location.href);
    url.pathname = `/studio/${threadId}`;
    router.push(url.pathname + "?" + url.searchParams.toString());
    setIsMobileMenuOpen(false);
  };

  const handleShopChange = (newShopId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("shop", newShopId);
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/auth");
      router.refresh();
    });
  };

  if (userShops === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-pulse">
            <Menu className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (userShops.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-semibold mb-4">No Shop Access</h1>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have access to any shops yet. Please contact your
            shop administrator to get invited.
          </p>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden lg:block w-[320px] shrink-0 border-r border-border">
        <ThreadSidebar
          shopId={currentShopId!}
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
            shopId={currentShopId!}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
          />
        </SheetContent>
      </Sheet>

      <main className={cn("flex-1 flex flex-col min-w-0 overflow-hidden")}>
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            {userShops.length > 1 && (
              <Select value={currentShopId} onValueChange={handleShopChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select shop" />
                </SelectTrigger>
                <SelectContent>
                  {userShops.map((shop) => (
                    <SelectItem
                      key={shop._id}
                      value={shop._id}
                      className="cursor-pointer"
                    >
                      {shop.shopifyDomain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {userShops.length === 1 && (
              <span className="text-sm font-medium">
                {currentShop?.shopifyDomain}
              </span>
            )}
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
