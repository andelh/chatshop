import { setupConvexAuthServer } from "@convex-dev/auth/ssr";
import { api } from "@/convex/_generated/api";

/**
 * Convex Auth's server side for the `/auth/signin`, `/auth/refresh` and
 * `/auth/signout` route handlers. Only functions that create a session belong
 * in `signIn`; anything else gets a 403 from the proxy route.
 */
export const auth = setupConvexAuthServer({
  // biome-ignore lint/style/noNonNullAssertion: required at build time
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  refreshSession: api.auth.refreshSession,
  signOut: api.auth.signOut,
  signIn: [
    api.auth.signInWithEmailPassword,
    api.auth.completeSignUpWithEmailPassword,
    api.auth.completePasswordRecovery,
  ],
  cookieOptions: { secure: process.env.NODE_ENV === "production" },
});
