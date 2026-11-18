"use client";

import { useCompleteSignUpWithEmailPassword } from "@convex-dev/auth/methods/email-password/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { authErrorMessage } from "@/lib/auth-errors";

/** Landing page for the sign-up email link. Finishing sign-up signs the user in. */
export function ValidateEmailScreen() {
  const router = useRouter();
  const emailCode = useSearchParams().get("code") ?? "";
  const state = useCompleteSignUpWithEmailPassword(api.auth, { emailCode });

  useEffect(() => {
    if (state.status === "complete") {
      router.push("/studio");
    }
  }, [state.status, router]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-white px-6 text-black">
      <div className="w-full max-w-[400px] space-y-6 text-center">
        {state.status === "error" ? (
          <>
            <h1 className="text-[28px] font-bold tracking-tight">
              Couldn’t verify your email
            </h1>
            <p className="rounded-[20px] bg-[#FFF0F0] px-5 py-4 text-[14.5px] font-medium text-[#E03131]">
              {authErrorMessage(state.userError)}
            </p>
            <Link
              href="/auth?mode=signup"
              className="text-[14.5px] font-medium text-[#8A8A8A] hover:text-black"
            >
              Back to sign up
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="text-[15.5px] font-medium text-[#808080]">
              {state.status === "complete"
                ? "Email verified. Signing you in."
                : "Verifying your email…"}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
