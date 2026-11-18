import { redirect } from "next/navigation";
import { SettingsPageClient } from "@/components/settings/settings-page";
import { isAuthenticatedNextjs } from "@/lib/convex-auth";

export default async function SettingsPage() {
  if (!(await isAuthenticatedNextjs())) {
    redirect("/auth");
  }

  return <SettingsPageClient />;
}
