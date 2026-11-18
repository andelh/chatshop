import { afterEach, describe, expect, it, vi } from "vitest";
import { runShopAssistant } from "./lib/agent/assistant";

// No `ai` mock here: this runs the real AI SDK + @ai-sdk/anthropic and
// checks the HTTP request they build for the default model.

function anthropicMessage(content: unknown[], stopReason = "end_turn") {
  return Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20 },
  });
}

function anthropicResponse(text: string) {
  return anthropicMessage([{ type: "text", text }]);
}

const STOREFRONT = { endpoint: "https://shop.test/graphql", accessToken: "x" };
const OPUS_LOW = {
  aiProvider: "anthropic" as const,
  aiModel: "claude-opus-5-5",
  providerOptions: { anthropicEffort: "low" },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Anthropic request", () => {
  it("sends Opus 5.5 at low effort with adaptive thinking and a user-first conversation", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => anthropicResponse("Hi there!"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runShopAssistant({
      history: [
        // Window starting mid-conversation on an assistant turn.
        { role: "assistant", content: "Anything else?" },
        { role: "user", content: "do you have the iPhone 15?" },
        { role: "user", content: "in blue" },
      ],
      storefront: {
        endpoint: "https://example.test/graphql",
        accessToken: "x",
      },
      settings: {
        aiProvider: "anthropic",
        aiModel: "claude-opus-5-5",
        providerOptions: { anthropicEffort: "low" },
      },
      system: "You are a test assistant.",
    });

    expect(result.text).toBe("Hi there!");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("api.anthropic.com");
    const body = JSON.parse(String(init.body));

    expect(body.model).toBe("claude-opus-5-5");
    expect(JSON.stringify(body)).toContain('"effort":"low"');
    // Summarized so Studio's reasoning view has something to show.
    expect(body.thinking).toEqual({ type: "adaptive", display: "summarized" });
    // No forced tool use (Opus 5.5 rejects it).
    expect(body.tool_choice?.type ?? "auto").toBe("auto");
    expect(
      body.tools.map((t: { name: string }) => t.name).length,
    ).toBeGreaterThan(0);
    // Conversation opens and ends with the customer; no assistant prefill.
    expect(body.messages[0].role).toBe("user");
    expect(body.messages.at(-1).role).toBe("user");
  });

  it("carries signed thinking into the next step of a tool loop", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const anthropicBodies: any[] = [];
    let shopifyCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.startsWith(STOREFRONT.endpoint)) {
          shopifyCalls++;
          return Response.json({
            data: {
              collections: {
                edges: [
                  { node: { id: "c1", title: "Phones", handle: "phones" } },
                ],
              },
            },
          });
        }
        anthropicBodies.push(JSON.parse(String(init.body)));
        if (anthropicBodies.length === 1) {
          return anthropicMessage(
            [
              {
                type: "thinking",
                thinking: "Check the catalogue first.",
                signature: "sig_step1",
              },
              {
                type: "tool_use",
                id: "toolu_1",
                name: "getProductCategories",
                input: {},
              },
            ],
            "tool_use",
          );
        }
        return anthropicResponse("We stock phones!");
      }),
    );

    const result = await runShopAssistant({
      history: [{ role: "user", content: "what do you sell?" }],
      storefront: STOREFRONT,
      settings: OPUS_LOW,
      system: "You are a test assistant.",
    });

    expect(result.text).toBe("We stock phones!");
    expect(result.steps).toHaveLength(2);
    expect(shopifyCalls).toBe(1);
    expect(anthropicBodies).toHaveLength(2);

    // Step 2 sends back the assistant turn with its signed thinking block
    // and the tool_use, followed by the tool_result.
    const [, assistantTurn, toolResultTurn] = anthropicBodies[1].messages;
    expect(assistantTurn.role).toBe("assistant");
    expect(assistantTurn.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "thinking", signature: "sig_step1" }),
        expect.objectContaining({ type: "tool_use", id: "toolu_1" }),
      ]),
    );
    expect(toolResultTurn.role).toBe("user");
    expect(toolResultTurn.content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_1",
    });
    // Same effort and thinking settings on every step.
    expect(anthropicBodies[1].thinking).toEqual({
      type: "adaptive",
      display: "summarized",
    });
    expect(JSON.stringify(anthropicBodies[1])).toContain('"effort":"low"');
  });

  it("reports a refusal as finishReason content-filter", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => anthropicMessage([], "refusal")),
    );
    const result = await runShopAssistant({
      history: [{ role: "user", content: "hi" }],
      storefront: STOREFRONT,
      settings: OPUS_LOW,
      system: "You are a test assistant.",
    });
    expect(result.finishReason).toBe("content-filter");
  });
});
