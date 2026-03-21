"use client";

import { useQuery } from "convex/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { Sidenav } from "./sidenav";
import { ThreadList } from "./thread-list";

export function StudioShellV2({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [isSigningOut, startTransition] = useTransition();

  const selectedThreadId = params?.threadId as Id<"threads"> | undefined;
  const shopIdParam = searchParams.get("shop");

  // Wait for the client session to resolve before firing Convex queries.
  // Without this, queries fire unauthenticated during the hydration gap
  // when initialToken is null (e.g. Convex unreachable on server render).
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userName = session?.user?.name ?? undefined;
  const userEmail = session?.user?.email ?? undefined;

  const userShops = useQuery(
    api.shopMembers.listUserShops,
    sessionPending ? "skip" : undefined,
  );
  const currentShop =
    userShops?.find((s) => s._id === shopIdParam) ?? userShops?.[0];
  const currentShopId = currentShop?._id;

  // Stamp ?shop= into the URL once shops load (mirrors the old layout redirect)
  useEffect(() => {
    if (userShops && userShops.length > 0 && !shopIdParam) {
      const url = new URL(window.location.href);
      url.searchParams.set("shop", userShops[0]._id);
      router.replace(url.pathname + "?" + url.searchParams.toString());
    }
  }, [userShops, shopIdParam, router]);

  const handleSelectThread = (threadId: Id<"threads">) => {
    const url = new URL(window.location.href);
    url.pathname = `/studio-v2/${threadId}`;
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
      <div className="h-screen bg-[#E8E7E4] p-5 flex items-center justify-center">
        <div className="bg-white rounded-2xl w-full h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#888]">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (userShops.length === 0) {
    return (
      <div className="h-screen bg-[#E8E7E4] p-5 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-3 text-[#1A1A1A]">
            No Shop Access
          </h1>
          <p className="text-sm text-[#888] mb-6">
            Contact your shop admin to get invited.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-5 py-2 bg-[#1A1A1A] text-white text-sm rounded-lg font-medium hover:bg-[#333] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#E8E7E4] p-5 overflow-hidden">
      <div className="h-full bg-white rounded-2xl flex flex-row overflow-hidden shadow-sm">
        {/* Left sidenav */}
        <Sidenav
          onSignOut={handleSignOut}
          isSigningOut={isSigningOut}
          userName={userName}
          userEmail={userEmail}
        />

        {/* Thread list column */}
        {currentShopId && (
          <div className="w-[340px] h-full border-r border-[#EDECEA] shrink-0">
            <ThreadList
              shopId={currentShopId}
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
            />
          </div>
        )}

        {/* Main content area */}
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
