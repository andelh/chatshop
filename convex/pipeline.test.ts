import { sentEmails } from "@convex-dev/auth/components/email/test";
import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ISUPPLY_SYSTEM_PROMPT } from "./lib/agent/systemPrompt";
import { sendMetaMessage } from "./lib/messaging";
import {
  BATCH_DELAY_MS,
  FALLBACK_REPLY,
  HANDOFF_ONLY_REPLY,
  parseAssistantReply,
} from "./lib/pipeline";
import { addVerifiedEmail, setupConvex, signInAs } from "./test.setup";

// The model call is the only thing mocked; everything else runs for real
// inside convex-test, with Meta's Graph API stubbed via fetch.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});
const generateTextMock = vi.mocked(generateText);

const PAGE_ID = "page_1";
const CUSTOMER_ID = "customer_1";

type SentMessage = { recipient: string; text: string };

function modelReply(text: string) {
  return {
    text,
    steps: [],
    totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  } as unknown as Awaited<ReturnType<typeof generateText>>;
}

/** Stub the Graph API. Returns the list of text messages "delivered". */
function stubMeta(opts: { failSends?: boolean; profile?: object } = {}) {
  const sent: SentMessage[] = [];
  let nextMid = 1;
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (!init?.body) {
      // GET /{user-id}?fields=… profile lookup for a new thread.
      return opts.profile
        ? Response.json(opts.profile)
        : Response.json({ error: { message: "no access" } }, { status: 400 });
    }
    const body = JSON.parse(String(init.body));
    if (body.sender_action) {
      return Response.json({ recipient_id: body.recipient.id });
    }
    if (opts.failSends) {
      return Response.json(
        { error: { message: "Invalid OAuth access token", code: 190 } },
        { status: 400 },
      );
    }
    sent.push({ recipient: body.recipient.id, text: body.message.text });
    return Response.json({
      recipient_id: body.recipient.id,
      message_id: `m_out_${nextMid++}`,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { sent, fetchMock };
}

async function createShop(
  t: ReturnType<typeof setupConvex>,
  settings: Doc<"shops">["settings"] = { autoReplyEnabled: true },
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("shops", {
      shopifyDomain: "https://example.myshopify.com/api/graphql.json",
      shopifyAccessToken: "shopify_token",
      metaPageId: PAGE_ID,
      metaPageAccessToken: "page_token",
      settings,
      ownerId: "owner_1",
    }),
  );
}

async function receive(
  t: ReturnType<typeof setupConvex>,
  content: string,
  mid?: string,
) {
  return await t.mutation(internal.pendingMessages.enqueue, {
    platform: "messenger",
    pageId: PAGE_ID,
    senderId: CUSTOMER_ID,
    content,
    platformMessageId: mid,
  });
}

async function threadState(
  t: ReturnType<typeof setupConvex>,
  threadId: Id<"threads">,
) {
  return await t.run(async (ctx) => {
    const thread = await ctx.db.get(threadId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    const pending = await ctx.db
      .query("pending_messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    return { thread, messages, pending };
  });
}

function threadIdOf(result: Awaited<ReturnType<typeof receive>>) {
  if (result.status !== "queued")
    throw new Error(`not queued: ${result.status}`);
  return result.threadId;
}

beforeEach(() => {
  vi.useFakeTimers();
  generateTextMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseAssistantReply", () => {
  it("strips a bare handoff marker", () => {
    expect(parseAssistantReply("Let me check. ||HANDOFF||")).toEqual({
      parts: ["Let me check."],
      handoffReason: "AI requested handoff",
    });
  });

  it("strips a multi-line reason", () => {
    const parsed = parseAssistantReply(
      "One sec.||HANDOFF|| Trade-in question\nneeds a human",
    );
    expect(parsed.parts).toEqual(["One sec."]);
    expect(parsed.handoffReason).toBe("Trade-in question\nneeds a human");
  });

  it("splits parts and drops empties", () => {
    expect(parseAssistantReply("Hi! ||SPLIT|| ||SPLIT|| Yes.").parts).toEqual([
      "Hi!",
      "Yes.",
    ]);
  });

  it("never returns an empty reply for a bare handoff", () => {
    expect(parseAssistantReply("||HANDOFF|| refund").parts).toEqual([
      HANDOFF_ONLY_REPLY,
    ]);
  });

  it("throws on an empty reply with no handoff", () => {
    expect(() => parseAssistantReply("  ||SPLIT||  ")).toThrow();
  });
});

describe("batching", () => {
  it("answers a burst of messages once, with every mid stored", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Yes, we have it in stock."));

    const threadId = threadIdOf(await receive(t, "hi", "m_in_1"));
    await receive(t, "do you have the iPhone 15?", "m_in_2");
    await receive(t, "in blue", "m_in_3");

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([
      { recipient: CUSTOMER_ID, text: "Yes, we have it in stock." },
    ]);

    const { messages, pending, thread } = await threadState(t, threadId);
    expect(pending).toHaveLength(0);
    expect(thread?.batchStartedAt).toBeUndefined();
    expect(
      messages.map((m) => [m.role, m.content, m.platformMessageId]),
    ).toEqual([
      ["user", "hi", "m_in_1"],
      ["user", "do you have the iPhone 15?", "m_in_2"],
      ["user", "in blue", "m_in_3"],
      ["assistant", "Yes, we have it in stock.", "m_out_1"],
    ]);
  });

  it("keeps messages that arrive during generation and answers them next", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();

    generateTextMock.mockImplementationOnce(async () => {
      // Customer sends another message while the first reply is generating,
      // and generation takes a while.
      await receive(t, "also, do you ship?", "m_in_2");
      vi.setSystemTime(Date.now() + 20_000);
      return modelReply("Hi! It's $799.");
    });
    generateTextMock.mockResolvedValueOnce(modelReply("Yes, island-wide."));

    const threadId = threadIdOf(
      await receive(t, "price of iPhone 15?", "m_in_1"),
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(sent.map((m) => m.text)).toEqual([
      "Hi! It's $799.",
      "Yes, island-wide.",
    ]);

    const { messages, pending } = await threadState(t, threadId);
    expect(pending).toHaveLength(0);
    expect(
      messages.filter((m) => m.role === "user").map((m) => m.content),
    ).toEqual(["price of iPhone 15?", "also, do you ship?"]);

    // History is in conversation order: the late message comes after the
    // reply it arrived during, so the second generation answers it.
    expect(messages.map((m) => m.content)).toEqual([
      "price of iPhone 15?",
      "Hi! It's $799.",
      "also, do you ship?",
      "Yes, island-wide.",
    ]);
    const secondCall = generateTextMock.mock.calls[1][0];
    expect(secondCall.messages?.at(-1)).toEqual({
      role: "user",
      content: "also, do you ship?",
    });
  });

  it("defers a run while another holds the batch lock", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.run((ctx) =>
      ctx.db.patch(threadId, { batchStartedAt: Date.now() }),
    );

    const claim = await t.mutation(internal.pendingMessages.claimBatch, {
      threadId,
      senderId: CUSTOMER_ID,
      pageId: PAGE_ID,
      platform: "messenger",
    });
    expect(claim).toEqual({ status: "busy" });

    const { pending } = await threadState(t, threadId);
    expect(pending).toHaveLength(1);
  });

  it("hands off a thread whose run died after claiming its batch", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    const jobArgs = {
      threadId,
      senderId: CUSTOMER_ID,
      pageId: PAGE_ID,
      platform: "messenger",
    };

    // The action claims, then dies before calling finishBatch.
    const claim = await t.mutation(
      internal.pendingMessages.claimBatch,
      jobArgs,
    );
    if (claim.status !== "claimed") throw new Error(claim.status);
    const expiry = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).find(
        (job) => job.name.includes("expireBatch"),
      ),
    );
    expect(expiry?.args[0]).toMatchObject({ lockToken: claim.lockToken });

    // A stale token releases nothing.
    await t.mutation(internal.pendingMessages.finishBatch, {
      ...jobArgs,
      lockToken: claim.lockToken - 1,
    });
    expect((await threadState(t, threadId)).thread?.batchStartedAt).toBe(
      claim.lockToken,
    );

    await t.mutation(internal.pendingMessages.expireBatch, {
      ...jobArgs,
      lockToken: claim.lockToken,
    });
    const { thread, messages } = await threadState(t, threadId);
    expect(thread?.agentStatus).toBe("handoff");
    expect(thread?.batchStartedAt).toBeUndefined();
    expect(messages.map((m) => m.content)).toEqual(["hello"]);
    // Staff are emailed, as for any other handoff.
    const email = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).find(
        (job) => job.name.includes("sendHandoffEmail"),
      ),
    );
    expect(email?.args[0]).toMatchObject({
      threadId,
      reason: "AI reply did not finish",
    });
  });

  it("drops duplicate deliveries, pending or processed", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));

    await receive(t, "hello", "m_in_1");
    expect(await receive(t, "hello", "m_in_1")).toEqual({
      status: "duplicate",
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await receive(t, "hello", "m_in_1")).toEqual({
      status: "duplicate",
    });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("stores but doesn't answer messages on a paused thread", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.run((ctx) => ctx.db.patch(threadId, { agentStatus: "paused" }));

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(generateTextMock).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
    const { messages, pending } = await threadState(t, threadId);
    expect(pending).toHaveLength(0);
    expect(messages.map((m) => m.content)).toEqual(["hello"]);
  });

  it("waits BATCH_DELAY_MS after the latest message", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));

    await receive(t, "hello", "m_in_1");
    await vi.advanceTimersByTimeAsync(BATCH_DELAY_MS - 1_000);
    await receive(t, "anyone there?", "m_in_2");
    await vi.advanceTimersByTimeAsync(BATCH_DELAY_MS - 1_000);
    await t.finishInProgressScheduledFunctions();
    expect(generateTextMock).not.toHaveBeenCalled();

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });
});

describe("handoff", () => {
  it("never sends the marker and hands the thread off", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    generateTextMock.mockResolvedValue(
      modelReply("Let me check with the team. ||HANDOFF||"),
    );

    const threadId = threadIdOf(
      await receive(t, "can I trade in a Pixel?", "m_in_1"),
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent.map((m) => m.text)).toEqual(["Let me check with the team."]);
    const { thread } = await threadState(t, threadId);
    expect(thread?.agentStatus).toBe("handoff");
    expect(thread?.agentPausedReason).toBe("AI requested handoff");
  });

  it("sends split parts in order", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    generateTextMock.mockResolvedValue(
      modelReply("Hi there! ||SPLIT|| It's $799. ||HANDOFF|| check stock"),
    );

    const threadId = threadIdOf(await receive(t, "price?", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent.map((m) => m.text)).toEqual(["Hi there!", "It's $799."]);
    const { thread } = await threadState(t, threadId);
    expect(thread?.agentPausedReason).toBe("check stock");
  });
});

describe("failure path", () => {
  it("keeps the message, sends a fallback and hands off when the model fails", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    generateTextMock.mockRejectedValue(new Error("model overloaded"));

    const threadId = threadIdOf(await receive(t, "hello?", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent.map((m) => m.text)).toEqual([FALLBACK_REPLY]);
    const { thread, messages, pending } = await threadState(t, threadId);
    expect(pending).toHaveLength(0);
    expect(thread?.agentStatus).toBe("handoff");
    expect(thread?.agentPausedReason).toContain("model overloaded");
    expect(thread?.batchStartedAt).toBeUndefined();
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "hello?"],
      ["assistant", FALLBACK_REPLY],
    ]);
  });

  it("hands off with a refusal reason when the model declines", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    generateTextMock.mockResolvedValue({
      ...modelReply(""),
      finishReason: "content-filter",
    });

    const threadId = threadIdOf(await receive(t, "hello?", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent.map((m) => m.text)).toEqual([FALLBACK_REPLY]);
    const { thread } = await threadState(t, threadId);
    expect(thread?.agentStatus).toBe("handoff");
    expect(thread?.agentPausedReason).toContain("refusal");
  });

  it("doesn't record a reply Meta rejected", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta({ failSends: true });
    generateTextMock.mockResolvedValue(modelReply("Hi!"));

    const threadId = threadIdOf(await receive(t, "hello?", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent).toHaveLength(0);
    const { thread, messages } = await threadState(t, threadId);
    expect(thread?.agentStatus).toBe("handoff");
    expect(thread?.agentPausedReason).toContain("code 190");
    expect(messages.map((m) => m.role)).toEqual(["user"]);
  });
});

describe("page echoes", () => {
  it("ignores echoes of messages we sent", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const result = await t.mutation(internal.webhooks.recordPageEcho, {
      platform: "messenger",
      pageId: PAGE_ID,
      customerId: CUSTOMER_ID,
      platformMessageId: "m_out_1",
      content: "Hi!",
    });
    expect(result).toBe("ours");
    const { thread } = await threadState(t, threadId);
    expect(thread?.agentStatus).toBe("active");
  });

  it("records a staff reply from the native inbox and pauses the AI", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));

    const result = await t.mutation(internal.webhooks.recordPageEcho, {
      platform: "messenger",
      pageId: PAGE_ID,
      customerId: CUSTOMER_ID,
      platformMessageId: "m_staff_1",
      content: "Hey, this is Sam from the store.",
    });
    expect(result).toBe("recorded");

    // The queued customer message is stored but the AI stays quiet.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);

    const { thread, messages } = await threadState(t, threadId);
    expect(thread?.agentStatus).toBe("paused");
    expect(messages.map((m) => [m.role, m.platformMessageId])).toEqual(
      expect.arrayContaining([
        ["human_agent", "m_staff_1"],
        ["user", "m_in_1"],
      ]),
    );
  });
});

describe("sendMetaMessage", () => {
  it("tags staff replies outside the 24h window as HUMAN_AGENT", async () => {
    const { fetchMock } = stubMeta();
    await sendMetaMessage({
      recipientId: CUSTOMER_ID,
      text: "Following up on your order",
      accessToken: "page_token",
      humanAgentTag: true,
    });
    await sendMetaMessage({
      recipientId: CUSTOMER_ID,
      text: "Hi!",
      accessToken: "page_token",
    });

    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    );
    expect(bodies[0]).toMatchObject({
      messaging_type: "MESSAGE_TAG",
      tag: "HUMAN_AGENT",
    });
    expect(bodies[1]).toMatchObject({ messaging_type: "RESPONSE" });
    expect(bodies[1].tag).toBeUndefined();
  });

  it("throws on a Graph error instead of returning it", async () => {
    stubMeta({ failSends: true });
    await expect(
      sendMetaMessage({
        recipientId: CUSTOMER_ID,
        text: "Hi!",
        accessToken: "page_token",
      }),
    ).rejects.toThrow(/code 190/);
  });
});

describe("signed Meta webhook", () => {
  const APP_SECRET = "test_app_secret";

  async function postWebhook(
    t: ReturnType<typeof setupConvex>,
    payload: unknown,
    opts: { badSignature?: boolean } = {},
  ) {
    const body = JSON.stringify(payload);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(opts.badSignature ? "wrong" : APP_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body),
    );
    const hex = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return await t.fetch("/webhooks/meta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${hex}`,
      },
      body,
    });
  }

  function messengerEvent(event: Record<string, unknown>) {
    return { object: "page", entry: [{ id: PAGE_ID, messaging: [event] }] };
  }

  beforeEach(() => {
    vi.stubEnv("META_APP_SECRET", APP_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("queues a customer DM and answers it", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));

    const response = await postWebhook(
      t,
      messengerEvent({
        sender: { id: CUSTOMER_ID },
        recipient: { id: PAGE_ID },
        message: { mid: "m_in_1", text: "hello" },
      }),
    );
    expect(response.status).toBe(200);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent.map((m) => m.text)).toEqual(["Hi!"]);
  });

  it("rejects a bad signature without queueing", async () => {
    const t = setupConvex();
    await createShop(t);
    const response = await postWebhook(
      t,
      messengerEvent({
        sender: { id: CUSTOMER_ID },
        message: { mid: "m_in_1", text: "hello" },
      }),
      { badSignature: true },
    );
    expect(response.status).toBe(401);
    const pending = await t.run((ctx) =>
      ctx.db.query("pending_messages").collect(),
    );
    expect(pending).toHaveLength(0);
  });

  it("routes our own reply's echo to 'ours' and a staff echo to a takeover", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // Echo of the AI reply (mid m_out_1), then a staff photo from the inbox.
    for (const message of [
      { mid: "m_out_1", text: "Hi!", is_echo: true, app_id: 123 },
      {
        mid: "m_staff_1",
        is_echo: true,
        attachments: [{ type: "image" }],
      },
    ]) {
      await postWebhook(
        t,
        messengerEvent({
          sender: { id: PAGE_ID },
          recipient: { id: CUSTOMER_ID },
          timestamp: Date.now(),
          message,
        }),
      );
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const { thread, messages } = await threadState(t, threadId);
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "hello"],
      ["assistant", "Hi!"],
      ["human_agent", "[attachment]"],
    ]);
    expect(thread?.agentStatus).toBe("paused");
  });

  it("treats an echo matching our recent unsent-mid reply as ours", async () => {
    const t = setupConvex();
    await createShop(t);
    // Meta accepted the send but returned no message_id.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ recipient_id: CUSTOMER_ID })),
    );
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const sentAt = (await threadState(t, threadId)).messages.find(
      (m) => m.role === "assistant",
    )?.timestamp;

    const result = await t.mutation(internal.webhooks.recordPageEcho, {
      platform: "messenger",
      pageId: PAGE_ID,
      customerId: CUSTOMER_ID,
      platformMessageId: "m_out_unknown",
      content: "Hi!",
      timestamp: (sentAt ?? 0) + 1_000,
    });
    expect(result).toBe("ours");
    const { thread, messages } = await threadState(t, threadId);
    expect(thread?.agentStatus).toBe("active");
    expect(
      messages.find((m) => m.role === "assistant")?.platformMessageId,
    ).toBe("m_out_unknown");
  });
});

describe("auto-reply and business hours", () => {
  // Monday 2026-11-16, UTC.
  const mondayAt = (hhmm: string) => new Date(`2026-11-16T${hhmm}:00Z`);
  const weekdayHours = {
    timezone: "UTC",
    days: { mon: { open: "09:00", close: "17:00" } },
  };

  async function replyCount(settings: Doc<"shops">["settings"], at: Date) {
    vi.setSystemTime(at);
    const t = setupConvex();
    await createShop(t, settings);
    const { sent } = stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const { messages, thread } = await threadState(t, threadId);
    // The customer's message is always kept for staff.
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(thread?.batchStartedAt).toBeUndefined();
    return sent.length;
  }

  it("stores but doesn't reply when auto-reply is off", async () => {
    expect(
      await replyCount({ autoReplyEnabled: false }, mondayAt("10:00")),
    ).toBe(0);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("replies only inside business hours", async () => {
    const settings = { autoReplyEnabled: true, businessHours: weekdayHours };
    expect(await replyCount(settings, mondayAt("10:00"))).toBe(1);
    generateTextMock.mockClear();
    expect(await replyCount(settings, mondayAt("08:59"))).toBe(0);
    expect(await replyCount(settings, mondayAt("17:00"))).toBe(0);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("treats unparseable stored hours as no restriction", async () => {
    const settings = {
      autoReplyEnabled: true,
      businessHours: { timezone: "Mars/Olympus_Mons", days: {} },
    };
    expect(await replyCount(settings, mondayAt("03:00"))).toBe(1);
  });
});

describe("handoff email", () => {
  async function shopWithMembers(t: ReturnType<typeof setupConvex>) {
    const shopId = await createShop(t);
    const { owner, staff } = await t.run(async (ctx) => {
      const owner = await ctx.db.insert("users", {});
      const staff = await ctx.db.insert("users", {});
      await ctx.db.insert("shopMembers", {
        userId: owner,
        shopId,
        role: "owner",
      });
      await ctx.db.insert("shopMembers", {
        userId: staff,
        shopId,
        role: "member",
      });
      // A Better Auth-era row that matches no account.
      await ctx.db.insert("shopMembers", {
        userId: "ba_legacy_id",
        shopId,
        role: "member",
      });
      return { owner, staff };
    });
    await addVerifiedEmail(t, owner, "owner@shop.test");
    await addVerifiedEmail(t, staff, "staff@shop.test");
    return shopId;
  }

  it("emails every member once when the AI hands off", async () => {
    const t = setupConvex();
    const shopId = await shopWithMembers(t);
    stubMeta({ profile: { first_name: "Ana" } });
    generateTextMock.mockResolvedValue(
      modelReply(
        "Let me check with the team. ||HANDOFF|| Trade-in for a Pixel",
      ),
    );
    const threadId = threadIdOf(
      await receive(t, "can I trade in a Pixel?", "m_in_1"),
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const emails = await sentEmails(t);
    expect(emails.map((e) => e.to[0]).sort()).toEqual([
      "owner@shop.test",
      "staff@shop.test",
    ]);
    expect(emails[0].subject).toBe("Ana needs a reply on Messenger");
    expect(emails[0].text).toContain("Trade-in for a Pixel");
    expect(emails[0].text).toContain(
      `https://app.example.com/studio-v2/${threadId}?shop=${shopId}`,
    );
    expect(emails[0].from).toBe("Chatshop <auth@example.com>");

    // A second handoff request on the same thread doesn't email again.
    await t.mutation(internal.threads.internalRequestHandoff, {
      threadId,
      reason: "again",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await sentEmails(t)).toHaveLength(2);
  });

  it("emails on a failed reply too, and escapes the reason in HTML", async () => {
    const t = setupConvex();
    await shopWithMembers(t);
    stubMeta();
    generateTextMock.mockRejectedValue(
      new Error("<script>overloaded</script>"),
    );
    await receive(t, "hello", "m_in_1");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const emails = await sentEmails(t);
    expect(emails).toHaveLength(2);
    expect(emails[0].subject).toBe("A customer needs a reply on Messenger");
    expect(emails[0].html).toContain("&lt;script&gt;overloaded");
    expect(emails[0].html).not.toContain("<script>");
  });
});

describe("customer names", () => {
  it("names a new thread from its Messenger profile", async () => {
    const t = setupConvex();
    await createShop(t);
    const { fetchMock } = stubMeta({
      profile: { first_name: "Ana", last_name: "Lee" },
    });
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const { thread } = await threadState(t, threadId);
    expect(thread?.customerName).toBe("Ana Lee");
    const lookup = String(
      fetchMock.mock.calls.find(([, init]) => !init?.body)?.[0],
    );
    expect(lookup).toContain(`/${CUSTOMER_ID}?fields=first_name%2Clast_name`);
    expect(lookup).toContain("access_token=page_token");
  });

  it("leaves the name unset when Meta won't share it", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const { thread, messages } = await threadState(t, threadId);
    expect(thread?.customerName).toBeUndefined();
    // The reply still went out.
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("never overwrites a name that's already set", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta({ profile: { first_name: "Ana" } });
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    const threadId = threadIdOf(await receive(t, "hello", "m_in_1"));
    await t.run((ctx) => ctx.db.patch(threadId, { customerName: "VIP Ana" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await threadState(t, threadId)).thread?.customerName).toBe(
      "VIP Ana",
    );
  });
});

describe("per-shop system prompt", () => {
  it("answers as the shop a user created, never as iSupply", async () => {
    const t = setupConvex();
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    const owner = t.withIdentity(await signInAs(t, userId));
    await owner.mutation(api.shops.create, {
      profile: {
        storeName: "Acme Outdoors",
        assistantName: "Sam",
        policies: "Returns within 30 days.",
      },
      shopifyDomain: "https://acme.myshopify.com/api/2025-01/graphql.json",
      shopifyAccessToken: "storefront_token",
      metaPageId: PAGE_ID,
      metaPageAccessToken: "page_token",
    });
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    await receive(t, "hello", "m_in_1");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const system = String(generateTextMock.mock.calls[0][0].system);
    expect(system).toContain(
      "You are Sam, part of the customer support team at Acme Outdoors",
    );
    expect(system).toContain("Returns within 30 days.");
    expect(system).toContain("||SPLIT||");
    expect(system).toContain("||HANDOFF||");
    expect(system).not.toMatch(/isupply|maya/i);
  });

  it("keeps the iSupply prompt for a shop with no profile", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    await receive(t, "hello", "m_in_1");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(generateTextMock.mock.calls[0][0].system).toBe(
      ISUPPLY_SYSTEM_PROMPT,
    );
  });
});

describe("model call and retry", () => {
  it("calls Claude Opus 5.5 at low effort by default", async () => {
    const t = setupConvex();
    await createShop(t);
    stubMeta();
    generateTextMock.mockResolvedValue(modelReply("Hi!"));
    await receive(t, "hello", "m_in_1");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const call = generateTextMock.mock.calls[0][0];
    expect((call.model as { modelId: string }).modelId).toBe("claude-opus-5-5");
    expect(call.providerOptions).toEqual({
      anthropic: {
        effort: "low",
        thinking: { type: "adaptive", display: "summarized" },
      },
    });
  });

  it("retryMessage regenerates from the last customer turn and sends it", async () => {
    const t = setupConvex();
    await createShop(t);
    const { sent } = stubMeta();
    generateTextMock.mockResolvedValueOnce(modelReply("First answer."));
    const threadId = threadIdOf(await receive(t, "price?", "m_in_1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const { messages } = await threadState(t, threadId);
    const firstReply = messages.find((m) => m.role === "assistant");
    if (!firstReply) throw new Error("no reply");

    generateTextMock.mockResolvedValueOnce(modelReply("Better answer."));
    const result = await t.action(internal.scheduledActions.retryMessage, {
      threadId,
      messageId: firstReply._id,
    });

    expect(result.messageIds).toHaveLength(1);
    expect(sent.map((m) => m.text)).toEqual([
      "First answer.",
      "Better answer.",
    ]);
    const retryCall = generateTextMock.mock.calls[1][0];
    expect(retryCall.messages).toEqual([{ role: "user", content: "price?" }]);
  });
});
