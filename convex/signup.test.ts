import { sentEmails } from "@convex-dev/auth/components/email/test";
import authPassword from "@convex-dev/auth/components/password/test";
import { sessionIdentity } from "@convex-dev/auth/test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { isEmailAllowed, SIGNUP_NOT_ALLOWED } from "./lib/signup";
import { setupConvex } from "./test.setup";

// Real email + password sign-up through Convex Auth, with Resend stubbed.
// Password hashing is faked (vitest.config.mts aliases argon2id).

const PASSWORD = "a long and unusual passphrase 42";

function setup() {
  const t = setupConvex();
  authPassword.registerPassword(t);
  // The email component rate-limits per client IP.
  return { t, client: t.withRequestMetadata({ ip: "203.0.113.7" }) };
}

type Setup = ReturnType<typeof setup>;

/** The `code` of the `page` link in the last email sent. */
async function lastLinkCode({ t }: Setup, page: string) {
  const emails = await sentEmails(t);
  const body = emails.at(-1)?.html ?? emails.at(-1)?.text ?? "";
  const code = body.match(new RegExp(`${page}\\?code=([^"&\\s<]+)`))?.[1];
  if (!code) throw new Error(`no ${page} link in email: ${body.slice(0, 200)}`);
  return decodeURIComponent(code);
}

/** Start a sign-up and return what the validation link carries. */
async function startSignUp(env: Setup, email: string) {
  const result = await env.client.mutation(api.auth.signUpWithEmailPassword, {
    email,
    password: PASSWORD,
  });
  if (!result.success) throw new Error(JSON.stringify(result.userError));
  return {
    browserSecret: result.browserSecret,
    emailCode: await lastLinkCode(env, "validate-email"),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sign-up allowlist", () => {
  it("signs in a new account whose email is listed", async () => {
    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "owner@shop.test, Staff@Shop.test");
    const env = setup();
    const { client } = env;
    const link = await startSignUp(env, "staff@shop.test");
    const result = await client.mutation(
      api.auth.completeSignUpWithEmailPassword,
      link,
    );
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    const viewer = await client
      .withIdentity(sessionIdentity(result.tokens))
      .query(api.users.viewer, {});
    expect(viewer?.email).toBe("staff@shop.test");
  });

  it("refuses an unlisted email and leaves the link usable once it's added", async () => {
    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "owner@shop.test");
    const env = setup();
    const { client } = env;
    const link = await startSignUp(env, "stranger@else.test");

    await expect(
      client.mutation(api.auth.completeSignUpWithEmailPassword, link),
    ).rejects.toThrow(SIGNUP_NOT_ALLOWED);
    // The refusal rolled back the validation: no verified email, no sign-in.
    const signIn = await client.mutation(api.auth.signInWithEmailPassword, {
      email: "stranger@else.test",
      password: PASSWORD,
    });
    expect(signIn.status).toBe("error");

    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "owner@shop.test,stranger@else.test");
    const retry = await client.mutation(
      api.auth.completeSignUpWithEmailPassword,
      link,
    );
    expect(retry.status).toBe("complete");
  });

  it("refuses every new account when the allowlist is unset", async () => {
    const env = setup();
    const { client } = env;
    const link = await startSignUp(env, "owner@shop.test");
    await expect(
      client.mutation(api.auth.completeSignUpWithEmailPassword, link),
    ).rejects.toThrow(SIGNUP_NOT_ALLOWED);
  });

  it("still lets an existing shop member sign in when they aren't listed", async () => {
    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "member@shop.test");
    const env = setup();
    const { t, client } = env;
    const link = await startSignUp(env, "member@shop.test");
    const first = await client.mutation(
      api.auth.completeSignUpWithEmailPassword,
      link,
    );
    if (first.status !== "complete") throw new Error("sign-up failed");
    await t.run(async (ctx) => {
      const shopId = await ctx.db.insert("shops", {
        shopifyDomain: "https://example.myshopify.com/api/graphql.json",
        shopifyAccessToken: "shopify_token",
        metaPageId: "page_1",
        metaPageAccessToken: "page_token",
        settings: { autoReplyEnabled: true },
      });
      await ctx.db.insert("shopMembers", {
        userId: first.tokens.userId,
        shopId,
        role: "owner",
      });
    });

    // Taken off the list (or the variable dropped) after joining a shop.
    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "");
    const signIn = await client.mutation(api.auth.signInWithEmailPassword, {
      email: "member@shop.test",
      password: PASSWORD,
    });
    expect(signIn.status).toBe("complete");
  });
});

describe("password recovery", () => {
  it("refuses a non-member taken off the list, without burning the link", async () => {
    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "user@shop.test");
    const env = setup();
    const { client } = env;
    const signUp = await client.mutation(
      api.auth.completeSignUpWithEmailPassword,
      await startSignUp(env, "user@shop.test"),
    );
    expect(signUp.status).toBe("complete");

    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "");
    const start = await client.mutation(api.auth.startPasswordRecovery, {
      email: "user@shop.test",
    });
    if (!start.success) throw new Error(JSON.stringify(start.userError));
    const recovery = {
      browserSecret: start.browserSecret,
      emailCode: await lastLinkCode(env, "reset-password"),
      newPassword: "another long and unusual passphrase 7",
    };
    const refused = await client
      .mutation(api.auth.completePasswordRecovery, recovery)
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ConvexError);
    expect((refused as ConvexError<string>).data).toBe(SIGNUP_NOT_ALLOWED);

    // The refusal rolled back the reset: the same link still works.
    vi.stubEnv("ALLOWED_SIGNUP_EMAILS", "user@shop.test");
    const retry = await client.mutation(
      api.auth.completePasswordRecovery,
      recovery,
    );
    expect(retry.status).toBe("complete");
  });
});

describe("isEmailAllowed", () => {
  it("matches trimmed, case-insensitive entries only", () => {
    expect(isEmailAllowed("A@x.test", " a@x.test ,b@x.test")).toBe(true);
    // Decomposed vs precomposed "é", which Convex Auth treats as one address.
    expect(isEmailAllowed("e\u0301@x.test", "\u00e9@x.test")).toBe(true);
    expect(isEmailAllowed("c@x.test", "a@x.test,b@x.test")).toBe(false);
    expect(isEmailAllowed("a@x.test", undefined)).toBe(false);
    expect(isEmailAllowed("", ",")).toBe(false);
  });
});
