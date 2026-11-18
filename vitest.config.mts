import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
    // Convex Auth checks a token's issuer against this; any value works in
    // convex-test, which signs tokens itself.
    env: { CONVEX_CLOUD_URL: "https://test.convex.cloud" },
  },
});
