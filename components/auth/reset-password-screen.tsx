"use client";

import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Reset token is missing or invalid.");
      return;
    }

    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      const result = await authClient.resetPassword({
        token,
        newPassword: password,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Unable to reset password");
      }

      setMessage("Password updated. Redirecting you back to sign in.");
      setTimeout(() => {
        router.push("/auth?mode=signin&reset=1");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setIsPending(false);
    }
  };

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
            Choose a new password with at least 12 characters.
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
              minLength={12}
              placeholder="New password"
              className="h-16 rounded-[1.7rem] border-border/70 bg-white/75 px-6 text-lg shadow-[0_12px_48px_rgba(15,23,42,0.07)]"
              required
              disabled={isPending || !!message}
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
            disabled={isPending || !!message}
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
