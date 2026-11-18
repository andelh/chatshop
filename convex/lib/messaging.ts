import { META_GRAPH_BASE_URL } from "./metaGraph";

/** Thrown when the Send API rejects a message or can't be reached. */
export class MetaSendError extends Error {
  readonly status: number | undefined;
  readonly code: number | undefined;

  constructor(message: string, opts: { status?: number; code?: number } = {}) {
    super(message);
    this.name = "MetaSendError";
    this.status = opts.status;
    this.code = opts.code;
  }
}

/**
 * Send a text message through the Messenger / Instagram Send API.
 *
 * Throws MetaSendError unless Meta confirms the send, so callers never record
 * a message as sent when it wasn't. Returns Meta's message ID (`mid`), which
 * callers store so the webhook can recognise the echo as ours.
 *
 * `humanAgentTag` sends with the HUMAN_AGENT message tag. Use it only for
 * replies written by staff more than 24 hours after the customer's last
 * message; Meta allows those for up to 7 days and only for apps with the
 * Human Agent permission.
 */
export async function sendMetaMessage({
  recipientId,
  text,
  accessToken,
  humanAgentTag = false,
}: {
  recipientId: string;
  text: string;
  accessToken: string | undefined;
  humanAgentTag?: boolean;
}): Promise<{ messageId: string | undefined }> {
  if (!accessToken) {
    throw new MetaSendError("Shop has no Meta page access token");
  }

  const body = {
    recipient: { id: recipientId },
    message: { text },
    ...(humanAgentTag
      ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" }
      : { messaging_type: "RESPONSE" }),
    access_token: accessToken,
  };

  let response: Response;
  try {
    response = await fetch(`${META_GRAPH_BASE_URL}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new MetaSendError(
      `Meta Send API unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let data: {
    message_id?: string;
    error?: { message?: string; code?: number };
  } | null = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body; handled below.
  }

  if (!response.ok || data?.error) {
    const graphError = data?.error;
    throw new MetaSendError(
      `Meta Send API error (HTTP ${response.status}${
        graphError?.code !== undefined ? `, code ${graphError.code}` : ""
      }): ${graphError?.message ?? "unknown error"}`,
      { status: response.status, code: graphError?.code },
    );
  }

  return { messageId: data?.message_id };
}

/**
 * Best-effort typing indicator. Never throws: a failed indicator must not
 * stop a reply from being generated or sent.
 */
export async function sendTypingIndicator({
  recipientId,
  accessToken,
  action,
}: {
  recipientId: string;
  accessToken: string | undefined;
  action: "typing_on" | "typing_off";
}): Promise<boolean> {
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`${META_GRAPH_BASE_URL}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: action,
        access_token: accessToken,
      }),
    });
    if (!response.ok) {
      console.warn(
        `Typing indicator (${action}) failed: HTTP ${response.status}`,
      );
    }
    return response.ok;
  } catch (error) {
    console.warn(`Typing indicator (${action}) failed:`, error);
    return false;
  }
}
