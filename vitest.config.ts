import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "server/zcos/trading/**/*.test.ts",
      "shared/**/*.test.ts",
      "client/src/zebulon/**/*.test.ts",
    ],
    testTimeout: 15000,
  },
});
