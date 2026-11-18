import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { setupConvex, signInAs } from "./test.setup";

// Drives the public Studio actions touched by the pipeline changes as the
// shop's member, a different signed-in user, and an anonymous caller.

const DAY_MS = 24 * 60 * 60_000;

type Fixture = {
  t: ReturnType<typeof setupConvex>;
  threadId: Id<"threads">;
  member: ReturnType<ReturnType<typeof setupConvex>["withIdentity"]>;
  stranger: ReturnType<ReturnType<typeof setupConvex>["withIdentity"]>;
};

async function seed(lastCustomerMessageAgoMs: number): Promise<Fixture> {
  const t = setupConvex();
  const { threadId, memberId, strangerId } = await t.run(async (ctx) => {
    const memberId = await ctx.db.insert("users", {});
    const strangerId = await ctx.db.insert("users", {});
    const shopId = await ctx.db.insert("shops", {
      shopifyDomain: "https://example.myshopify.com/api/graphql.json",
      shopifyAccessToken: "shopify_token",
      metaPageId: "page_1",
      metaPageAccessToken: "page_token",
      settings: { autoReplyEnabled: true },
      ownerId: memberId,
    });
    await ctx.db.insert("shopMembers", {
      userId: memberId,
      shopId,
      role: "owner",
    });
    // The stranger owns a different shop.
    const otherShopId = await ctx.db.insert("shops", {
      shopifyDomain: "https://other.myshopify.com/api/graphql.json",
      shopifyAccessToken: "other_token",
      metaPageId: "page_2",
      metaPageAccessToken: "other_page_token",
      settings: { autoReplyEnabled: true },
      ownerId: strangerId,
    });
    await ctx.db.insert("shopMembers", {
      userId: strangerId,
      shopId: otherShopId,
      role: "owner",
    });

    const sentAt = Date.now() - lastCustomerMessageAgoMs;
    const threadId = await ctx.db.insert("threads", {
      shopId,
      platform: "messenger",
      platformUserId: "customer_1",
      status: "active",
      agentStatus: "active",
      lastMessageAt: sentAt,
      unreadCount: 1,
    });
    await ctx.db.insert("messages", {
      threadId,
      role: "user",
      content: "is my order on the way?",
      timestamp: sentAt,
    });
    return { threadId, memberId, strangerId };
  });

  return {
    t,
    threadId,
    member: t.withIdentity(await signInAs(t, memberId)),
    stranger: t.withIdentity(await signInAs(t, strangerId)),
  };
}

function stubSendApi() {
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    return Response.json({
      recipient_id: body.recipient.id,
      message_id: "m_staff_out",
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBodies(fetchMock: ReturnType<typeof stubSendApi>) {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendHumanAgentMessage", () => {
  it("sends inside the 24h window as a normal response and stores the mid", async () => {
    const { t, threadId, member } = await seed(2 * 60 * 60_000);
    const fetchMock = stubSendApi();

    await member.action(api.messages.sendHumanAgentMessage, {
      threadId,
      content: "Yes, it shipped this morning.",
    });

    expect(sentBodies(fetchMock)).toEqual([
      expect.objectContaining({ messaging_type: "RESPONSE" }),
    ]);
    const stored = await t.run((ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_platform_message_id", (q) =>
          q.eq("platformMessageId", "m_staff_out"),
        )
        .first(),
    );
    expect(stored?.role).toBe("human_agent");
    const thread = await t.run((ctx) => ctx.db.get(threadId));
    expect(thread?.agentStatus).toBe("paused");
  });

  it("uses the HUMAN_AGENT tag after 24h", async () => {
    const { threadId, member } = await seed(2 * DAY_MS);
    const fetchMock = stubSendApi();

    await member.action(api.messages.sendHumanAgentMessage, {
      threadId,
      content: "Sorry for the wait, it shipped today.",
    });

    expect(sentBodies(fetchMock)).toEqual([
      expect.objectContaining({
        messaging_type: "MESSAGE_TAG",
        tag: "HUMAN_AGENT",
      }),
    ]);
  });

  it("refuses a user from another shop and anonymous callers", async () => {
    const { t, threadId, stranger } = await seed(60_000);
    const fetchMock = stubSendApi();

    await expect(
      stranger.action(api.messages.sendHumanAgentMessage, {
        threadId,
        content: "hi",
      }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      t.action(api.messages.sendHumanAgentMessage, { threadId, content: "hi" }),
    ).rejects.toThrow(/Unauthenticated/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("simulateCustomerMessage", () => {
  it("queues through the shared pipeline for a member", async () => {
    const { t, threadId, member } = await seed(60_000);

    const result = await member.action(api.messages.simulateCustomerMessage, {
      threadId,
      content: "test message",
    });
    expect(result.success).toBe(true);

    const { pending, thread } = await t.run(async (ctx) => ({
      pending: await ctx.db
        .query("pending_messages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect(),
      thread: await ctx.db.get(threadId),
    }));
    expect(pending.map((p) => p.content)).toEqual(["test message"]);
    expect(thread?.scheduledJobId).toBe(result.jobId);
  });

  it("refuses a user from another shop and anonymous callers", async () => {
    const { t, threadId, stranger } = await seed(60_000);

    await expect(
      stranger.action(api.messages.simulateCustomerMessage, {
        threadId,
        content: "x",
      }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      t.action(api.messages.simulateCustomerMessage, {
        threadId,
        content: "x",
      }),
    ).rejects.toThrow(/Unauthenticated/);

    const pending = await t.run((ctx) =>
      ctx.db
        .query("pending_messages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect(),
    );
    expect(pending).toHaveLength(0);
  });
});
