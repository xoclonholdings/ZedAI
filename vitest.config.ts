import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "server/services/capital/**/*.test.ts",
      "server/services/fileProcessor.test.ts",
      "server/services/auth/**/*.test.ts",
      "server/services/intake/**/*.test.ts",
      "server/services/sms/**/*.test.ts",
      "shared/**/*.test.ts",
      "client/src/lib/uploadRequest.test.ts",
      "client/src/components/auth/**/*.test.ts",
      "client/src/nexys/communication/foregroundVoice.test.ts",
      "client/src/zebulon/**/*.test.ts",
    ],
    testTimeout: 15000,
  },
});
