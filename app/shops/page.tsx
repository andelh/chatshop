import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { ShopsPageClient } from "@/components/shops/shops-page";

export default async function ShopsPage() {
  if (!(await isAuthenticated())) {
    redirect("/auth");
  }

  return <ShopsPageClient />;
}
