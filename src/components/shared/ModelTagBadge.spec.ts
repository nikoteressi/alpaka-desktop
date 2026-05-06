import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ModelTagBadge from "./ModelTagBadge.vue";

describe("ModelTagBadge", () => {
  it("renders a span", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "vision" } });
    expect(wrapper.find("span").exists()).toBe(true);
  });

  it("displays 'Vision' for tag 'vision'", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "vision" } });
    expect(wrapper.text()).toBe("Vision");
  });

  it("displays 'Tools' for tag 'tools'", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "tools" } });
    expect(wrapper.text()).toBe("Tools");
  });

  it("displays 'Think' for tag 'thinking'", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "thinking" } });
    expect(wrapper.text()).toBe("Think");
  });

  it("displays 'Cloud' for tag 'cloud'", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "cloud" } });
    expect(wrapper.text()).toBe("Cloud");
  });

  it("displays uppercased size for tag matching size pattern (e.g. '7b')", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "7b" } });
    expect(wrapper.text()).toBe("7B");
  });

  it("displays raw tag for unknown tags", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "custom-tag" } });
    expect(wrapper.text()).toBe("custom-tag");
  });

  it("applies 'model-tag' base class", () => {
    const wrapper = mount(ModelTagBadge, { props: { tag: "vision" } });
    expect(wrapper.find("span").classes()).toContain("model-tag");
  });
});
