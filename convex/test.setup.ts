import aggregate from "@convex-dev/aggregate/test";
import authEmail, {
  registerResendStub,
} from "@convex-dev/auth/components/email/test";
import authCore, { sessionIdentity } from "@convex-dev/auth/test";
import { convexTest } from "convex-test";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// Every Convex module, excluding tests, type declarations and this file.
export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
  "!./test.setup.ts",
]);

export function setupConvex() {
  const t = convexTest(schema, modules);
  authCore.registerCore(t);
  // Handoff emails look up member addresses and send through Resend.
  authEmail.registerEmail(t);
  registerResendStub(t);
  for (const name of ["messagesByThread", "tokensByThread", "costByThread"]) {
    aggregate.register(t, name);
  }
  return t;
}

/**
 * Mint a real Convex Auth session for `userId` and return the identity to
 * pass to `t.withIdentity` (the token subject is the session id).
 */
export async function signInAs(
  t: ReturnType<typeof setupConvex>,
  userId: Id<"users">,
): Promise<{ subject: string }> {
  const tokens = await t.mutation(
    components.auth.public._internal_dangerous_signIn,
    {
      claims: { method: "test", profile: {} },
      componentPath: "test",
      userId,
      accessTokenTtlSeconds: 3600,
      refreshInactivityTimeoutSeconds: 86_400,
      sessionMaxLifetimeSeconds: 86_400,
    },
  );
  return sessionIdentity(tokens);
}

/**
 * Give `userId` a verified primary email in the auth email component, as a
 * finished sign-up would.
 */
export async function addVerifiedEmail(
  t: ReturnType<typeof setupConvex>,
  userId: string,
  email: string,
): Promise<void> {
  // convex-test has runInComponent at runtime but doesn't declare it.
  const testApi = t as unknown as {
    runInComponent(
      path: string,
      handler: (ctx: {
        db: { insert(table: string, doc: object): Promise<unknown> };
      }) => Promise<unknown>,
    ): Promise<unknown>;
  };
  await testApi.runInComponent("authEmail", (ctx) =>
    ctx.db.insert("verifiedEmails", {
      email,
      normalizedEmail: email.toLowerCase(),
      userId,
      isPrimary: true,
    }),
  );
}
