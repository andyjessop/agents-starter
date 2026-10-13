import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.store.test.ts"],
    environment: "node",
  },
});
