import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShopRedirector } from "@/components/studio/shop-redirector";
import { StudioShell } from "@/components/studio/studio-shell";
import { isAuthenticatedNextjs } from "@/lib/convex-auth";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticatedNextjs())) {
    redirect("/auth");
  }

  return (
    <Suspense>
      <StudioShell>
        <Suspense>
          <ShopRedirector />
        </Suspense>
        {children}
      </StudioShell>
    </Suspense>
  );
}
