import { afterEach, describe, expect, it, vi } from "vitest";
import { runShopAssistant } from "./lib/agent/assistant";

// No `ai` mock here: this runs the real AI SDK + @ai-sdk/anthropic and
// checks the HTTP request they build for the default model.

function anthropicResponse(text: string) {
  return Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20 },
  });
}

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
    expect(body.thinking).toMatchObject({ type: "adaptive" });
    // No forced tool use (Opus 5.5 rejects it).
    expect(body.tool_choice?.type ?? "auto").toBe("auto");
    expect(
      body.tools.map((t: { name: string }) => t.name).length,
    ).toBeGreaterThan(0);
    // Conversation opens and ends with the customer; no assistant prefill.
    expect(body.messages[0].role).toBe("user");
    expect(body.messages.at(-1).role).toBe("user");
  });
});
