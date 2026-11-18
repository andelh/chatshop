import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StudioShellV2 } from "@/components/studio-v2/shell";
import { isAuthenticatedNextjs } from "@/lib/convex-auth";

export default async function StudioV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticatedNextjs())) {
    redirect("/auth");
  }

  return (
    <Suspense>
      <StudioShellV2>{children}</StudioShellV2>
    </Suspense>
  );
}
