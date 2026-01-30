// Model pricing from models.dev (per 1M tokens in USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.2": { input: 1.75, output: 14.0 },
  "gpt-5.2-codex": { input: 1.75, output: 14.0 },
  "gpt-5.1": { input: 1.25, output: 10.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] || { input: 2.0, output: 10.0 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
