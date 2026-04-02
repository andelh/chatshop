import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { StudioShellV2 } from "@/components/studio-v2/shell";

export default async function StudioV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/auth");
  }

  return (
    <Suspense>
      <StudioShellV2>{children}</StudioShellV2>
    </Suspense>
  );
}
