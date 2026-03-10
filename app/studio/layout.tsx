import { redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/studio-shell";
import { isAuthenticated } from "@/lib/auth-server";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/auth");
  }

  return <StudioShell>{children}</StudioShell>;
}
