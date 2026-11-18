import { setupEmailPassword } from "@convex-dev/auth/methods/email-password/server";
import { setupConvexAuth } from "@convex-dev/auth/server";
import { components, internal } from "./_generated/api";
import { env } from "./_generated/server";

const SITE_URL = env.SITE_URL ?? "http://localhost:3000";

const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;

export const {
  signUpWithEmailPassword,
  completeSignUpWithEmailPassword,
  signInWithEmailPassword,
  changePassword,
  startChangeEmail,
  completeChangeEmail,
  startPasswordRecovery,
  checkPasswordRecovery,
  completePasswordRecovery,
} = setupEmailPassword(auth, {
  component: components.authEmail,
  passwordComponent: components.authPassword,
  emailSender: {
    kind: "resend",
    sendEmail: components.resend.lib.sendEmail,
    apiKey: env.RESEND_API_KEY,
    from: `${env.SENDER_NAME ?? "Chatshop"} <${env.SENDER_EMAIL}>`,
  },
  // Landing pages live under /auth, which the Next.js proxy leaves public.
  urls: {
    signUp: `${SITE_URL}/auth/validate-email`,
    changeEmail: `${SITE_URL}/auth/confirm-email-change`,
    recovery: `${SITE_URL}/auth/reset-password`,
  },
}).attachUserCallbacks({ createUser: internal.users.createUser });
