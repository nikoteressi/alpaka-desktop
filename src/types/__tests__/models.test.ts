import { describe, it, expectTypeOf } from "vitest";
import type { ModelCapabilities } from "../models";

describe("ModelCapabilities", () => {
  it("has optional context_length field", () => {
    const caps: ModelCapabilities = {
      name: "llama3",
      thinking: false,
      thinking_toggleable: false,
      thinking_levels: [],
      tools: false,
      vision: false,
      embedding: false,
      audio: false,
      cloud: false,
      context_length: 32768,
    };
    expectTypeOf(caps.context_length).toMatchTypeOf<number | undefined>();
  });
});
