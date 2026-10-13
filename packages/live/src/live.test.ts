import { describe, expect, it } from "vitest";

import { livePath, parseLivePath } from "./live.ts";

describe("live paths", () => {
  it("round-trips session scope", () => {
    const scope = { kind: "session" as const };
    expect(livePath(scope)).toBe("/v1/live/session");
    expect(parseLivePath("/v1/live/session")).toEqual(scope);
  });

  it("round-trips demo catalogue scope", () => {
    const scope = { kind: "demo-catalogue" as const };
    expect(livePath(scope)).toBe("/v1/live/demo-catalogue");
    expect(parseLivePath("/v1/live/demo-catalogue")).toEqual(scope);
  });
});
