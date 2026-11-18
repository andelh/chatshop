"use client";

import { useCompletePasswordRecovery } from "@convex-dev/auth/methods/email-password/react";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { authErrorMessage } from "@/lib/auth-errors";

export function ResetPasswordScreen() {
  const searchParams = useSearchParams();
  const emailCode = searchParams.get("code") ?? "";
  const state = useCompletePasswordRecovery(api.auth, { emailCode });
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // A successful reset signs the user in.
  useEffect(() => {
    if (state.status === "complete") {
      router.push("/studio");
    }
  }, [state.status, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "ready") return;
    setSubmitError(null);
    const result = await state.completePasswordRecovery({
      newPassword: password,
    });
    if (result.status !== "complete") {
      setSubmitError(authErrorMessage(result.userError));
    }
  };

  const isPending = state.status === "ready" && state.pending;
  const message =
    state.status === "complete" ? "Password updated. Signing you in." : null;
  const error =
    state.status === "error" ? authErrorMessage(state.userError) : submitError;
  const formDisabled = state.status !== "ready" || isPending;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(22,144,235,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f3f4f6_100%)] px-6 py-16">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          {message ? (
            <CheckCircle2 className="h-9 w-9" />
          ) : (
            <LockKeyhole className="h-9 w-9" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-foreground">
            Set a new password
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose a new password with at least 10 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="sr-only">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={10}
              placeholder="New password"
              className="h-16 rounded-[1.7rem] border-border/70 bg-white/75 px-6 text-lg shadow-[0_12px_48px_rgba(15,23,42,0.07)]"
              required
              disabled={formDisabled}
            />
          </div>

          {error && (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground">
              {message}
            </p>
          )}

          <Button
            type="submit"
            disabled={formDisabled}
            className="h-16 w-full rounded-[1.7rem] text-lg font-medium shadow-[0_18px_40px_rgba(22,144,235,0.28)]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating password
              </>
            ) : (
              "Reset password"
            )}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          <Link href="/auth?mode=signin" className="hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
