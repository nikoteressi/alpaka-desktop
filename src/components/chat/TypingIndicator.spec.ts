import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TypingIndicator from "./TypingIndicator.vue";

describe("TypingIndicator", () => {
  it("renders without crashing", () => {
    const wrapper = mount(TypingIndicator);
    expect(wrapper.exists()).toBe(true);
  });

  it("renders three animated dots", () => {
    const wrapper = mount(TypingIndicator);
    const dots = wrapper.findAll("[class*='animate-bounce']");
    expect(dots.length).toBe(3);
  });
});
