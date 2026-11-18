/**
 * Who may create an account. Shared by the Convex sign-in callback and the
 * auth UI, so it has no server imports.
 */

/** `ConvexError` data when an account isn't approved. */
export const SIGNUP_NOT_ALLOWED = "SIGNUP_NOT_ALLOWED";

/** Lowercase, then NFC: how Convex Auth compares addresses. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().normalize("NFC");
}

/** Whether `email` is in a comma-separated allowlist (case-insensitive). */
export function isEmailAllowed(
  email: string,
  allowlist: string | undefined,
): boolean {
  const wanted = normalizeEmail(email);
  if (!wanted) return false;
  return (allowlist ?? "")
    .split(",")
    .some((entry) => normalizeEmail(entry) === wanted);
}
