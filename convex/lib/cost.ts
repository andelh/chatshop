// Model pricing from models.dev (per 1M tokens in USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI models - from models.dev API
  "gpt-5.2": { input: 1.75, output: 14.0 },
  "gpt-5.1": { input: 1.25, output: 10.0 },
  "gpt-5": { input: 1.25, output: 10.0 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-5-mini": { input: 0.75, output: 3.0 },
  "gpt-5-nano": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "o4-mini": { input: 1.1, output: 4.4 },

  // Google Gemini models
  "gemini-2.0-flash": { input: 0.35, output: 0.7 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 3.5, output: 10.5 },
  "gemini-1.5-flash": { input: 0.35, output: 0.7 },
  "gemini-2.5-pro-exp-03-25": { input: 3.5, output: 10.5 },
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
