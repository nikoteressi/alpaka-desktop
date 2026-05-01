import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));

const { default: ApiKeyPanel } = await import("./ApiKeyPanel.vue");

async function tick(n = 3) {
  for (let i = 0; i < n; i++) await nextTick();
}

async function mountPanel(
  opts: { status?: string; hostId?: string | null } = {},
) {
  const { status = "not_set", hostId = "host-uuid-1" } = opts;
  mockInvoke.mockResolvedValueOnce(status); // loadApiKeyStatus on mount
  const wrapper = mount(ApiKeyPanel);
  await tick();

  // Set active host after mount so store is initialised
  const { useHostStore } = await import("../../stores/hosts");
  const hostStore = useHostStore();
  hostStore.activeHostId = hostId;

  return wrapper;
}

describe("ApiKeyPanel — status badge", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("shows 'Not set' when status is not_set", async () => {
    const wrapper = await mountPanel({ status: "not_set" });
    expect(wrapper.text()).toContain("Not set");
  });

  it("shows 'Not set' when status is unknown (initial state)", async () => {
    const wrapper = await mountPanel({ status: "unknown" });
    expect(wrapper.text()).toContain("Not set");
  });

  it("shows 'Key saved' badge with accent class when status is set", async () => {
    const wrapper = await mountPanel({ status: "set" });
    expect(wrapper.text()).toContain("Key saved");
    const badge = wrapper.find("span.rounded-full");
    expect(badge.classes().join(" ")).toContain("text-[var(--accent)]");
  });

  it("shows 'Valid' badge with green class when status is valid", async () => {
    const wrapper = await mountPanel({ status: "valid" });
    expect(wrapper.text()).toContain("Valid");
    const badge = wrapper.find("span.rounded-full");
    expect(badge.classes().join(" ")).toContain("text-green-500");
  });

  it("shows 'Invalid' badge with danger class when status is invalid", async () => {
    const wrapper = await mountPanel({ status: "invalid" });
    expect(wrapper.text()).toContain("Invalid");
    const badge = wrapper.find("span.rounded-full");
    expect(badge.classes().join(" ")).toContain("text-[var(--danger)]");
  });

  it("shows 'Checking...' badge while validating", async () => {
    const wrapper = await mountPanel({ status: "checking" });
    expect(wrapper.text()).toContain("Checking...");
    const badge = wrapper.find("span.rounded-full");
    expect(badge.classes().join(" ")).toContain("text-[var(--accent)]");
  });
});

describe("ApiKeyPanel — save action", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("calls set_api_key then validate_api_key on save", async () => {
    const wrapper = await mountPanel({ status: "not_set" });

    const input = wrapper.find("input");
    await input.setValue("sk-test-key-abc");

    mockInvoke.mockResolvedValueOnce(undefined); // set_api_key
    mockInvoke.mockResolvedValueOnce([]); // list_hosts (fetchHosts after key save)
    mockInvoke.mockResolvedValueOnce(true); // validate_api_key

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Save"));
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(mockInvoke).toHaveBeenCalledWith("set_api_key", {
      key: "sk-test-key-abc",
    });
    expect(mockInvoke).toHaveBeenCalledWith("validate_api_key", {
      hostId: "host-uuid-1",
    });
  });

  it("clears input after successful save", async () => {
    const wrapper = await mountPanel({ status: "not_set" });

    const input = wrapper.find("input");
    await input.setValue("sk-test-key-abc");

    mockInvoke.mockResolvedValueOnce(undefined); // set_api_key
    mockInvoke.mockResolvedValueOnce([]); // list_hosts (fetchHosts after key save)
    mockInvoke.mockResolvedValueOnce(true); // validate_api_key

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Save"));
    await saveBtn!.trigger("click");
    await flushPromises();

    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("surfaces backend error message on save failure", async () => {
    const wrapper = await mountPanel({ status: "not_set" });

    const input = wrapper.find("input");
    await input.setValue("x".repeat(513));

    mockInvoke.mockRejectedValueOnce({
      Auth: "API key exceeds maximum allowed length",
    });

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Save"));
    await saveBtn!.trigger("click");
    await tick();

    expect(wrapper.text()).toContain("API key exceeds maximum allowed length");
  });

  it("surfaces string errors directly", async () => {
    const wrapper = await mountPanel({ status: "not_set" });

    const input = wrapper.find("input");
    await input.setValue("some-key");

    mockInvoke.mockRejectedValueOnce("keyring unavailable");

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Save"));
    await saveBtn!.trigger("click");
    await tick();

    expect(wrapper.text()).toContain("keyring unavailable");
  });

  it("Save button is disabled when input is empty", async () => {
    const wrapper = await mountPanel({ status: "not_set" });
    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Save"));
    expect((saveBtn!.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("triggers save on Enter keydown", async () => {
    const wrapper = await mountPanel({ status: "not_set" });

    const input = wrapper.find("input");
    await input.setValue("sk-enter-key");

    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(false);

    await input.trigger("keydown.enter");
    await tick();

    expect(mockInvoke).toHaveBeenCalledWith("set_api_key", {
      key: "sk-enter-key",
    });
  });
});

describe("ApiKeyPanel — validate action", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("shows error when no active host is selected", async () => {
    const wrapper = await mountPanel({ status: "set", hostId: null });

    const validateBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Validate");
    await validateBtn!.trigger("click");
    await tick();

    expect(wrapper.text()).toContain("No active host selected");
  });

  it("calls validate_api_key with the active host ID", async () => {
    const wrapper = await mountPanel({ status: "set", hostId: "host-uuid-42" });

    mockInvoke.mockResolvedValueOnce(true);

    const validateBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Validate");
    await validateBtn!.trigger("click");
    await tick();

    expect(mockInvoke).toHaveBeenCalledWith("validate_api_key", {
      hostId: "host-uuid-42",
    });
  });

  it("badge reverts to 'Not set' when validate_api_key errors (store absorbs error)", async () => {
    const wrapper = await mountPanel({ status: "set" });

    // Store catches errors internally — sets status to "unknown", returns false
    mockInvoke.mockRejectedValueOnce(new Error("network error"));

    const validateBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Validate");
    await validateBtn!.trigger("click");
    await tick();

    // "unknown" maps to "Not set" label
    expect(wrapper.text()).toContain("Not set");
  });
});

describe("ApiKeyPanel — remove action", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("shows confirm dialog when Remove is clicked", async () => {
    const wrapper = await mountPanel({ status: "set" });

    const removeBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Remove");
    await removeBtn!.trigger("click");
    await tick();

    expect(wrapper.text()).toContain("Remove stored key?");
    expect(wrapper.text()).toContain("Yes, remove");
  });

  it("calls delete_api_key on confirm", async () => {
    const wrapper = await mountPanel({ status: "set" });

    const removeBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Remove");
    await removeBtn!.trigger("click");
    await tick();

    mockInvoke.mockResolvedValueOnce(undefined); // delete_api_key
    mockInvoke.mockResolvedValueOnce([]); // list_hosts (fetchHosts after remove)

    const confirmBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Yes, remove");
    await confirmBtn!.trigger("click");
    await flushPromises();

    expect(mockInvoke).toHaveBeenCalledWith("delete_api_key", undefined);
  });

  it("hides confirm dialog and restore Remove button on cancel", async () => {
    const wrapper = await mountPanel({ status: "set" });

    const removeBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Remove");
    await removeBtn!.trigger("click");
    await tick();

    const cancelBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Cancel");
    await cancelBtn!.trigger("click");
    await tick();

    expect(wrapper.text()).not.toContain("Remove stored key?");
    expect(wrapper.findAll("button").some((b) => b.text() === "Remove")).toBe(
      true,
    );
  });

  it("shows error when delete_api_key fails", async () => {
    const wrapper = await mountPanel({ status: "set" });

    const removeBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Remove");
    await removeBtn!.trigger("click");
    await tick();

    mockInvoke.mockRejectedValueOnce(new Error("keyring error"));

    const confirmBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Yes, remove");
    await confirmBtn!.trigger("click");
    await tick();

    expect(wrapper.text()).toContain("Failed to remove key.");
  });
});

describe("ApiKeyPanel — show/hide key toggle", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("input starts as password type", async () => {
    const wrapper = await mountPanel({ status: "not_set" });
    const input = wrapper.find("input");
    expect(input.attributes("type")).toBe("password");
  });

  it("toggles to text type when eye button is clicked", async () => {
    const wrapper = await mountPanel({ status: "not_set" });

    const toggleBtn = wrapper.find("button[type='button']");
    await toggleBtn.trigger("click");
    await tick();

    const input = wrapper.find("input");
    expect(input.attributes("type")).toBe("text");
  });

  it("toggles back to password when clicked again", async () => {
    const wrapper = await mountPanel({ status: "not_set" });

    const toggleBtn = wrapper.find("button[type='button']");
    await toggleBtn.trigger("click");
    await tick();
    await toggleBtn.trigger("click");
    await tick();

    const input = wrapper.find("input");
    expect(input.attributes("type")).toBe("password");
  });
});
