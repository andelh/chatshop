import { redirect } from "next/navigation";
import { SettingsPageClient } from "@/components/settings/settings-page";
import { isAuthenticated } from "@/lib/auth-server";

export default async function SettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/auth");
  }

  return <SettingsPageClient />;
}
