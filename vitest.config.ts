import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic (mock-data derivation + the tier/sort/position
// rules). Node environment — these modules have no DOM/React dependency.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(process.cwd()) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
