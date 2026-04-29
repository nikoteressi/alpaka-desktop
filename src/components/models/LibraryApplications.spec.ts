import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("../../lib/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

// CustomTooltip wraps its slot content — stub it to keep tests simple
const CustomTooltipStub = {
  name: "CustomTooltip",
  template: "<div><slot /></div>",
  props: ["text", "wrapperClass"],
};

import LibraryApplications from "./LibraryApplications.vue";
import { copyToClipboard } from "../../lib/clipboard";

const MOCK_APPS = [
  {
    name: "Open WebUI",
    command: "docker run -d -p 3000:8080 ghcr.io/open-webui/open-webui",
    icon_url: "https://example.com/icon.png",
  },
  {
    name: "Enchanted",
    command: "brew install enchanted",
    icon_url: "https://example.com/enchanted.png",
  },
];

describe("LibraryApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when apps array is empty", () => {
    const wrapper = mount(LibraryApplications, {
      props: { apps: [] },
      global: { stubs: { CustomTooltip: CustomTooltipStub } },
    });
    expect(wrapper.find(".flex.flex-col").exists()).toBe(false);
  });

  it("renders the Applications section heading when apps are provided", () => {
    const wrapper = mount(LibraryApplications, {
      props: { apps: MOCK_APPS },
      global: { stubs: { CustomTooltip: CustomTooltipStub } },
    });
    expect(wrapper.text()).toContain("Applications");
  });

  it("renders one row per app", () => {
    const wrapper = mount(LibraryApplications, {
      props: { apps: MOCK_APPS },
      global: { stubs: { CustomTooltip: CustomTooltipStub } },
    });
    const rows = wrapper.findAll(".flex.items-center.justify-between");
    expect(rows).toHaveLength(MOCK_APPS.length);
  });

  it("shows app name and command for each entry", () => {
    const wrapper = mount(LibraryApplications, {
      props: { apps: MOCK_APPS },
      global: { stubs: { CustomTooltip: CustomTooltipStub } },
    });
    expect(wrapper.text()).toContain("Open WebUI");
    expect(wrapper.text()).toContain(MOCK_APPS[0].command);
    expect(wrapper.text()).toContain("Enchanted");
  });

  it("calls copyToClipboard with the app command when copy button is clicked", async () => {
    const wrapper = mount(LibraryApplications, {
      props: { apps: MOCK_APPS },
      global: { stubs: { CustomTooltip: CustomTooltipStub } },
    });

    const copyButtons = wrapper.findAll("button");
    await copyButtons[0].trigger("click");

    expect(copyToClipboard).toHaveBeenCalledWith(MOCK_APPS[0].command);
  });

  it("hides the icon img element on load error", async () => {
    const wrapper = mount(LibraryApplications, {
      props: { apps: [MOCK_APPS[0]] },
      global: { stubs: { CustomTooltip: CustomTooltipStub } },
    });

    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);

    await img.trigger("error");

    expect((img.element as HTMLImageElement).style.display).toBe("none");
  });
});
