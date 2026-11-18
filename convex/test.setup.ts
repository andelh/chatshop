import aggregate from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import schema from "./schema";

// Every Convex module, excluding tests, type declarations and this file.
export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
  "!./test.setup.ts",
]);

export function setupConvex() {
  const t = convexTest(schema, modules);
  for (const name of ["messagesByThread", "tokensByThread", "costByThread"]) {
    aggregate.register(t, name);
  }
  return t;
}
