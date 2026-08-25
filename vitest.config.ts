import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic: the app's mock-data derivation + tier/sort/
// position rules (lib/*.test.ts), and the source-profiler's parsing/sanitizing
// core (tools/profile/*.test.mjs, issue #11). Node environment — no DOM/React.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(process.cwd()) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tools/**/*.test.mjs"],
  },
});
