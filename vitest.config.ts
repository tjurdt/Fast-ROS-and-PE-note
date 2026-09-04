import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/v2/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
