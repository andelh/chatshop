import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Convex Auth's password component hashes with a WASM module that
      // vitest can't load.
      "password-hash-wasm/argon2id": fileURLToPath(
        new URL("./test/fakeArgon2id.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test", "@convex-dev/auth"] } },
    // Convex Auth checks a token's issuer against this; any value works in
    // convex-test, which signs tokens itself.
    env: {
      CONVEX_CLOUD_URL: "https://test.convex.cloud",
      // Required by convex/auth.ts at load; sign-up tests stub Resend.
      RESEND_API_KEY: "re_test",
      SENDER_EMAIL: "auth@example.com",
      SITE_URL: "https://app.example.com",
    },
  },
});
