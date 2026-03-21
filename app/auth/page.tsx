import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/auth-screen";
import { isAuthenticated } from "@/lib/auth-server";

export default async function AuthPage() {
  if (await isAuthenticated()) {
    redirect("/studio");
  }

  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  );
}
