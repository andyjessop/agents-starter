import type { LiveClient, LiveHandle } from "./client.ts";

export interface AppExtra {
  origin: string;
  fetch: typeof globalThis.fetch;
  live: LiveClient;
  liveHandles: Map<string, LiveHandle>;
  subscribe?: (listener: () => void) => () => void;
  restartSession?: () => void;
  openExternalUrl?: (url: string) => void;
}
