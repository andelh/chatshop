import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { StudioShell } from "@/components/studio/studio-shell";
import { ShopRedirector } from "@/components/studio/shop-redirector";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
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
