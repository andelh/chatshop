type AuthEmailKind = "verify-email" | "reset-password";

const getSubject = (kind: AuthEmailKind) =>
  kind === "verify-email"
    ? "Verify your Chatshop email"
    : "Reset your Chatshop password";

const getHtml = (kind: AuthEmailKind, url: string) => {
  const heading =
    kind === "verify-email" ? "Confirm your email" : "Reset your password";
  const body =
    kind === "verify-email"
      ? "Use the link below to verify your email and finish setting up your account."
      : "Use the link below to choose a new password for your account.";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;padding:24px">
      <h1 style="font-size:20px;margin-bottom:12px">${heading}</h1>
      <p style="margin-bottom:16px">${body}</p>
      <p style="margin-bottom:20px">
        <a href="${url}" style="display:inline-block;background:#1690eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600">
          ${kind === "verify-email" ? "Verify email" : "Reset password"}
        </a>
      </p>
      <p style="font-size:14px;color:#6b7280;word-break:break-all">${url}</p>
    </div>
  `;
};

export async function sendAuthEmail({
  kind,
  to,
  url,
}: {
  kind: AuthEmailKind;
  to: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;

  if (!apiKey || !from) {
    console.log(`[auth email:${kind}] ${to} -> ${url}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: getSubject(kind),
      html: getHtml(kind, url),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to send auth email: ${text}`);
  }
}
