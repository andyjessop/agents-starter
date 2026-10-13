import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { workspaceResolve } from "../../vitest.workspace.ts";

/**
 * Browser contract suite (Playwright) is deferred until the workspace
 * Vitest browser provider is wired for this package. Specs remain in src/.
 */
export default defineConfig({
  resolve: {
    conditions: workspaceResolve.conditions,
  },
  plugins: [react()],
  test: {
    name: "design-system",
    watch: false,
    include: ["src/**/*.spec.{ts,tsx}"],
    passWithNoTests: true,
  },
});
