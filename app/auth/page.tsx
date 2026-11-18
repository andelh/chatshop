import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { isAuthenticatedNextjs } from "@/lib/convex-auth";

export default async function AuthPage() {
  if (await isAuthenticatedNextjs()) {
    redirect("/studio");
  }

  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  );
}
