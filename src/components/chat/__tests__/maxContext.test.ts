import { describe, it, expect } from "vitest";

function resolveMaxContext(
  perChatOverride: number | undefined,
  modelContextLength: number | undefined,
  globalNumCtx: number | undefined,
): number {
  return perChatOverride ?? modelContextLength ?? globalNumCtx ?? 4096;
}

describe("resolveMaxContext", () => {
  it("per-chat override takes priority over model native", () => {
    expect(resolveMaxContext(8192, 32768, 4096)).toBe(8192);
  });

  it("falls back to model native when no per-chat override", () => {
    expect(resolveMaxContext(undefined, 32768, 4096)).toBe(32768);
  });

  it("falls back to global setting when neither per-chat nor model native", () => {
    expect(resolveMaxContext(undefined, undefined, 8192)).toBe(8192);
  });

  it("falls back to 4096 as last resort", () => {
    expect(resolveMaxContext(undefined, undefined, undefined)).toBe(4096);
  });
});
