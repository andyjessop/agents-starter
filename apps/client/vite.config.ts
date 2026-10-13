import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { mockApiPlugin } from "./vite-mock-api.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@agent-starter/live": fileURLToPath(
        new URL("../../packages/live/src/index.ts", import.meta.url),
      ),
      "@agent-starter/design-system": fileURLToPath(
        new URL("../../packages/design-system/src/index.ts", import.meta.url),
      ),
      "typed-redux-router": fileURLToPath(
        new URL("../../packages/redux-router/src/index.ts", import.meta.url),
      ),
    },
  },
  plugins: [react(), mockApiPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
