"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";

export function ShopRedirector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopIdParam = searchParams.get("shop");
  const userShops = useQuery(api.shopMembers.listUserShops);

  useEffect(() => {
    if (userShops && userShops.length > 0 && !shopIdParam) {
      const url = new URL(window.location.href);
      url.searchParams.set("shop", userShops[0]._id);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    }
  }, [userShops, shopIdParam, router]);

  return null;
}
