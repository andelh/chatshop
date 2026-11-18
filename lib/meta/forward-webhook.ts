/**
 * Meta webhooks are verified and processed by the Convex HTTP action at
 * `${CONVEX_SITE_URL}/webhooks/meta`. These Next.js routes stay as thin
 * pass-throughs so the callback URLs configured in the Meta app don't change.
 *
 * The body is forwarded byte-for-byte: the signature check runs over the raw
 * payload, so it must not be parsed or re-serialized here.
 */
function convexWebhookUrl(search = ""): string {
  const siteUrl =
    process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error(
      "Missing CONVEX_SITE_URL (or NEXT_PUBLIC_CONVEX_SITE_URL) for webhook forwarding",
    );
  }
  return `${siteUrl.replace(/\/$/, "")}/webhooks/meta${search}`;
}

export async function forwardMetaVerification(req: Request): Promise<Response> {
  const { search } = new URL(req.url);
  const response = await fetch(convexWebhookUrl(search), { method: "GET" });
  return new Response(await response.text(), { status: response.status });
}

export async function forwardMetaEvent(req: Request): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") ?? "application/json",
  };
  const signature = req.headers.get("x-hub-signature-256");
  if (signature) {
    headers["X-Hub-Signature-256"] = signature;
  }

  const response = await fetch(convexWebhookUrl(), {
    method: "POST",
    headers,
    body: await req.arrayBuffer(),
  });
  return new Response(await response.text(), { status: response.status });
}
