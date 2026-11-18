import { redirect } from "next/navigation";
import { ShopsPageClient } from "@/components/shops/shops-page";
import { isAuthenticatedNextjs } from "@/lib/convex-auth";

export default async function ShopsPage() {
  if (!(await isAuthenticatedNextjs())) {
    redirect("/auth");
  }

  return <ShopsPageClient />;
}
