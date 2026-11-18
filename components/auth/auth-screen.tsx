"use client";

import {
  useSignInWithEmailPassword,
  useSignUpWithEmailPassword,
  useStartPasswordRecovery,
} from "@convex-dev/auth/methods/email-password/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { authErrorMessage } from "@/lib/auth-errors";

type Mode = "signin" | "signup" | "forgot";

const footerLinks = [
  { href: "#", label: "Developers" },
  { href: "#", label: "Privacy" },
  { href: "#", label: "Terms" },
];

function FlowerMark() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      <span className="absolute left-0 top-0 h-4 w-4 rounded-full bg-black" />
      <span className="absolute right-0 top-0 h-4 w-4 rounded-full bg-black" />
      <span className="absolute bottom-0 left-0 h-4 w-4 rounded-full bg-black" />
      <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-black" />
      <span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-full bg-black" />
      <span className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-black" />
      <span className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-black" />
      <span className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-black" />
      <span className="relative z-10 h-7 w-7 rounded-[8px] border-[3px] border-white bg-black" />
    </div>
  );
}

export function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = (searchParams.get("mode") as Mode | null) ?? "signin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { signIn, pending: signInPending } = useSignInWithEmailPassword(
    api.auth,
  );
  const { signUp, pending: signUpPending } = useSignUpWithEmailPassword(
    api.auth,
  );
  const { startPasswordRecovery, pending: recoveryPending } =
    useStartPasswordRecovery(api.auth);
  const isPending = signInPending || signUpPending || recoveryPending;

  const title = useMemo(() => {
    if (mode === "signup") return "Create your account";
    if (mode === "forgot") return "Reset your password";
    return "Log in to Clerkit";
  }, [mode]);

  const subtitle = useMemo(() => {
    if (mode === "signup") return "Sign up to manage your store conversations.";
    if (mode === "forgot")
      return "We’ll send a reset link if your account exists.";
    return "Log in with your email and password to continue.";
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const trimmedEmail = email.trim();

    if (mode === "signup") {
      const result = await signUp({ email: trimmedEmail, password });
      if (!result.success) {
        setError(authErrorMessage(result.userError));
        return;
      }
      setMessage(
        "Check your email for a link to finish signing up. Open it in this browser.",
      );
      return;
    }

    if (mode === "forgot") {
      const result = await startPasswordRecovery({ email: trimmedEmail });
      if (!result.success && result.userError.error !== "EMAIL_NOT_FOUND") {
        setError(authErrorMessage(result.userError));
        return;
      }
      // Same message whether or not the account exists.
      setMessage(
        "If that email has an account, we’ve sent a reset link. Open it in this browser within 10 minutes.",
      );
      return;
    }

    const result = await signIn({ email: trimmedEmail, password });
    if (result.status !== "complete") {
      setError(authErrorMessage(result.userError));
      return;
    }
    router.push("/studio");
    router.refresh();
  };

  const showPassword = mode !== "forgot";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white text-black font-sans selection:bg-[#E5E5E5] selection:text-black">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="mb-10 flex justify-center">
            <FlowerMark />
          </div>

          <div className="mb-10 text-center">
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-black leading-tight">
              {title}
            </h1>
            <p className="mt-2 text-[15.5px] text-[#808080] font-medium leading-relaxed max-w-[340px] mx-auto">
              {subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                className="h-[52px] w-full rounded-full border border-[#E5E5E5] bg-[#F9F9F9] px-5 text-[15px] sm:text-[16px] text-black shadow-none transition-colors placeholder:text-[#A1A1AA] focus-visible:border-black focus-visible:bg-white focus-visible:ring-0"
                required
                disabled={isPending}
              />
            </div>

            {showPassword && (
              <div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === "signup" ? "Create a password" : "Password"
                  }
                  className="h-[52px] w-full rounded-full border border-[#E5E5E5] bg-[#F9F9F9] px-5 text-[15px] sm:text-[16px] text-black shadow-none transition-colors placeholder:text-[#A1A1AA] focus-visible:border-black focus-visible:bg-white focus-visible:ring-0"
                  minLength={10}
                  required
                  disabled={isPending}
                />
              </div>
            )}

            {error && (
              <p className="rounded-[20px] bg-[#FFF0F0] px-5 py-4 text-center text-[14.5px] font-medium text-[#E03131]">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-[20px] bg-[#F4F4F5] px-5 py-4 text-center text-[14.5px] font-medium text-[#52525B]">
                {message}
              </p>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="mt-2 h-[52px] w-full rounded-full bg-black text-[15px] sm:text-[16px] font-semibold tracking-wide text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-[#111111] active:scale-[0.98]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Please wait
                </>
              ) : mode === "signup" ? (
                "Create account"
              ) : mode === "forgot" ? (
                "Send reset link"
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          {/* Toggle Links */}
          <div className="mt-8 flex flex-col items-center gap-2 text-[14.5px] font-medium text-[#8A8A8A]">
            {mode === "signin" ? (
              <>
                <button
                  type="button"
                  className="transition-colors hover:text-black"
                  onClick={() => router.push("/auth?mode=signup")}
                >
                  Don't have an account? Sign up
                </button>
                <button
                  type="button"
                  className="transition-colors hover:text-black mt-2"
                  onClick={() => router.push("/auth?mode=forgot")}
                >
                  Forgot your password?
                </button>
              </>
            ) : mode === "signup" ? (
              <button
                type="button"
                className="transition-colors hover:text-black"
                onClick={() => router.push("/auth?mode=signin")}
              >
                Already have an account? Log in
              </button>
            ) : (
              <button
                type="button"
                className="transition-colors hover:text-black"
                onClick={() => router.push("/auth?mode=signin")}
              >
                Back to login
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pb-8 pt-4">
        <div className="flex items-center justify-center gap-6 text-[13px] font-medium text-[#A1A1AA]">
          {footerLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-[#52525B]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
