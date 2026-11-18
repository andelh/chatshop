/**
 * How long to wait after a customer's latest message before replying. People
 * often send several short DMs in a row; every new message restarts this
 * timer, so the AI answers them together once the customer pauses for 8s.
 */
export const BATCH_DELAY_MS = 8_000;

/**
 * A thread's batch lock (threads.batchStartedAt) older than this is treated
 * as abandoned (e.g. the action crashed or timed out) and can be taken over.
 * Convex actions time out after 10 minutes.
 */
export const BATCH_LOCK_STALE_MS = 10 * 60_000;

/**
 * Delay before handling a page "echo" webhook. The echo of our own reply can
 * arrive before the mutation that stores its mid has committed; waiting lets
 * us tell our sends apart from staff replies in Meta Business Suite.
 */
export const ECHO_GRACE_MS = 15_000;

/** Meta's standard messaging window after the customer's last message. */
export const STANDARD_MESSAGING_WINDOW_MS = 24 * 60 * 60_000;

/** Pause between the parts of a ||SPLIT|| reply, for natural pacing. */
export const SPLIT_PART_DELAY_MS = 700;

/** Sent to the customer when the AI can't produce or deliver a reply. */
export const FALLBACK_REPLY =
  "Sorry, I'm having a little trouble right now. Someone from our team will get back to you shortly.";

/** Sent when the model hands off without writing anything for the customer. */
export const HANDOFF_ONLY_REPLY =
  "Let me get someone from our team to help with this. They'll reply here shortly.";

const HANDOFF_MARKER = "||HANDOFF||";
const SPLIT_MARKER = /\|\|SPLIT\|\|/;
const DEFAULT_HANDOFF_REASON = "AI requested handoff";

export interface ParsedReply {
  /** Message parts to send, in order. Never empty. */
  parts: string[];
  /** Set when the model asked for a human; the reason is never sent. */
  handoffReason: string | null;
}

/**
 * Turn raw model output into customer-facing parts.
 *
 * Everything from the first ||HANDOFF|| marker onwards is internal: it's the
 * handoff reason, possibly empty or multi-line, and is never sent. A bare
 * handoff gets HANDOFF_ONLY_REPLY so the customer isn't left in silence.
 * Throws if there is nothing to send and no handoff.
 */
export function parseAssistantReply(text: string): ParsedReply {
  let visible = text;
  let handoffReason: string | null = null;

  const markerIndex = text.indexOf(HANDOFF_MARKER);
  if (markerIndex !== -1) {
    visible = text.slice(0, markerIndex);
    const reason = text.slice(markerIndex + HANDOFF_MARKER.length).trim();
    handoffReason = reason.length > 0 ? reason : DEFAULT_HANDOFF_REASON;
  }

  const parts = visible
    .split(SPLIT_MARKER)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    if (!handoffReason) {
      throw new Error("Model returned an empty reply");
    }
    parts.push(HANDOFF_ONLY_REPLY);
  }

  return { parts, handoffReason };
}
