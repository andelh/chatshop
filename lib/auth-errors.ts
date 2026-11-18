import type {
  CompletePasswordRecoveryResult,
  CompletePasswordRecoveryState,
  CompleteSignUpState,
  SignInResult,
  SignUpResult,
  StartPasswordRecoveryResult,
} from "@convex-dev/auth/methods/email-password/react";
import { ConvexError } from "convex/values";
import { SIGNUP_NOT_ALLOWED } from "@/convex/lib/signup";

type UserErrorOf<T> = T extends { userError: infer E } ? E : never;

/** Every user-facing error the email + password flows can return. */
export type AuthUserError =
  | UserErrorOf<SignInResult>
  | UserErrorOf<SignUpResult>
  | UserErrorOf<StartPasswordRecoveryResult>
  | UserErrorOf<CompletePasswordRecoveryResult>
  | UserErrorOf<CompletePasswordRecoveryState>
  | UserErrorOf<CompleteSignUpState>;

function retryHint(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return seconds < 60
    ? `${seconds} seconds`
    : `${Math.ceil(seconds / 60)} minutes`;
}

/**
 * A message for the user. Exhaustive on purpose: a new error code in a
 * Convex Auth upgrade fails the typecheck here instead of showing nothing.
 */
export function authErrorMessage(userError: AuthUserError): string {
  switch (userError.error) {
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "EMAIL_TAKEN":
      return "An account with this email already exists. Log in instead.";
    // Same message for both, so the form doesn't reveal which emails have
    // accounts.
    case "USER_NOT_FOUND":
    case "INVALID_CREDENTIALS":
      return "Incorrect email or password.";
    case "EMAIL_NOT_FOUND":
      return "If that email has an account, we've sent a reset link.";
    case "RATE_LIMITED":
      return `Too many attempts. Try again in ${retryHint(userError.retryAfterMs)}.`;
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${userError.minimumLength} characters.`;
    case "PASSWORD_TOO_LONG":
      return `Use at most ${userError.maximumLength} characters.`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Passwords can't start or end with a space.";
    case "PASSWORD_TOO_COMMON":
      return "That password is too common. Choose a different one.";
    case "MISSING_SECRET":
      return "Open this link in the same browser you used to request it.";
    case "INVALID_CHALLENGE":
      return "This link has expired or was already used. Request a new one.";
    case "INCORRECT_CODE":
      return "This link is invalid. Request a new one.";
    case "OTHER_ERROR":
      if (
        userError.cause instanceof ConvexError &&
        userError.cause.data === SIGNUP_NOT_ALLOWED
      ) {
        return "This email isn't approved for an account yet. Ask the store owner to add you.";
      }
      return "Something went wrong. Please try again.";
    default:
      userError satisfies never;
      return "Something went wrong. Please try again.";
  }
}
