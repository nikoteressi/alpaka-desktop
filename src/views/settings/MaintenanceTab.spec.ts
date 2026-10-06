import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

import MaintenanceTab from "./MaintenanceTab.vue";

const NOTICE = '[data-testid="db-key-file-notice"]';

async function mountTab() {
  const wrapper = mount(MaintenanceTab, {
    global: { stubs: { ConfirmationModal: true } },
  });
  await flushPromises();
  return wrapper;
}

describe("MaintenanceTab database key notice", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("asks the backend where the database key is stored", async () => {
    mockInvoke.mockResolvedValue(false);
    await mountTab();
    expect(mockInvoke).toHaveBeenCalledWith("get_db_key_in_file");
  });

  it("shows the notice when the key is kept in db.key", async () => {
    mockInvoke.mockResolvedValue(true);
    const wrapper = await mountTab();
    const notice = wrapper.find(NOTICE);
    expect(notice.exists()).toBe(true);
    expect(notice.text()).toContain("Database key stored in a file");
    expect(notice.text()).toContain("db.key");
  });

  it("hides the notice when the key is in the system keyring", async () => {
    mockInvoke.mockResolvedValue(false);
    const wrapper = await mountTab();
    expect(wrapper.find(NOTICE).exists()).toBe(false);
  });

  it("hides the notice if the backend call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValue(new Error("boom"));
    const wrapper = await mountTab();
    expect(wrapper.find(NOTICE).exists()).toBe(false);
  });
});
