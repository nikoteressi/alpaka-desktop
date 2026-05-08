import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { tauriApi, extractErrorMessage } from "./tauri";

describe("extractErrorMessage", () => {
  it("returns message from Error instances", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("converts non-Error values to string", () => {
    expect(extractErrorMessage("raw string")).toBe("raw string");
    expect(extractErrorMessage(42)).toBe("42");
    expect(extractErrorMessage(null)).toBe("null");
  });
});

describe("tauriApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Chat ──────────────────────────────────────────────────────────────────

  it("getMessages calls invoke with correct args", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await tauriApi.getMessages("conv-1");
    expect(invoke).toHaveBeenCalledWith("get_messages", {
      conversationId: "conv-1",
    });
  });

  it("listConversations calls invoke with limit and offset", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await tauriApi.listConversations(20, 0);
    expect(invoke).toHaveBeenCalledWith("list_conversations", {
      limit: 20,
      offset: 0,
    });
  });

  it("createConversation passes model, title, systemPrompt", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    await tauriApi.createConversation("llama3", "My Chat", "Be concise");
    expect(invoke).toHaveBeenCalledWith("create_conversation", {
      model: "llama3",
      title: "My Chat",
      systemPrompt: "Be concise",
    });
  });

  it("createConversation defaults title and systemPrompt to null", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    await tauriApi.createConversation("llama3");
    expect(invoke).toHaveBeenCalledWith("create_conversation", {
      model: "llama3",
      title: null,
      systemPrompt: null,
    });
  });

  it("updateConversationTitle calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.updateConversationTitle("c1", "New Title");
    expect(invoke).toHaveBeenCalledWith("update_conversation_title", {
      conversationId: "c1",
      title: "New Title",
    });
  });

  it("updateConversationModel calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.updateConversationModel("c1", "gemma");
    expect(invoke).toHaveBeenCalledWith("update_conversation_model", {
      conversationId: "c1",
      model: "gemma",
    });
  });

  it("updateConversationSettings calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.updateConversationSettings("c1", { temperature: 0.7 });
    expect(invoke).toHaveBeenCalledWith("update_conversation_settings", {
      conversationId: "c1",
      settings: { temperature: 0.7 },
    });
  });

  it("setConversationPinned calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.setConversationPinned("c1", true);
    expect(invoke).toHaveBeenCalledWith("set_conversation_pinned", {
      conversationId: "c1",
      pinned: true,
    });
  });

  it("updateSystemPrompt calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.updateSystemPrompt("c1", "You are helpful");
    expect(invoke).toHaveBeenCalledWith("update_system_prompt", {
      conversationId: "c1",
      systemPrompt: "You are helpful",
    });
  });

  it("deleteConversation calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.deleteConversation("c1");
    expect(invoke).toHaveBeenCalledWith("delete_conversation", {
      conversationId: "c1",
    });
  });

  it("sendMessage passes all params to invoke", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    const params = {
      conversationId: "c1",
      content: "hello",
      images: null,
      model: "llama3",
      folderContext: null,
      webSearchEnabled: false,
      thinkMode: null,
    };
    await tauriApi.sendMessage(params);
    expect(invoke).toHaveBeenCalledWith("send_message", params);
  });

  it("stopGeneration calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.stopGeneration();
    expect(invoke).toHaveBeenCalledWith("stop_generation");
  });

  it("exportConversation calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.exportConversation("c1");
    expect(invoke).toHaveBeenCalledWith("export_conversation", {
      conversationId: "c1",
    });
  });

  it("exportConversationMarkdown calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.exportConversationMarkdown("c1");
    expect(invoke).toHaveBeenCalledWith("export_conversation_markdown", {
      conversationId: "c1",
    });
  });

  it("backupDatabase calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.backupDatabase();
    expect(invoke).toHaveBeenCalledWith("backup_database");
  });

  // ── Models ────────────────────────────────────────────────────────────────

  it("listModels calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await tauriApi.listModels();
    expect(invoke).toHaveBeenCalledWith("list_models");
  });

  it("deleteModel calls invoke with name", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.deleteModel("llama3");
    expect(invoke).toHaveBeenCalledWith("delete_model", { name: "llama3" });
  });

  it("pullModel calls invoke with name", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.pullModel("llama3");
    expect(invoke).toHaveBeenCalledWith("pull_model", { name: "llama3" });
  });

  it("getModelCapabilities calls invoke with name", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    await tauriApi.getModelCapabilities("llama3");
    expect(invoke).toHaveBeenCalledWith("get_model_capabilities", {
      name: "llama3",
    });
  });

  it("getModelDefaults calls invoke with modelName", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null);
    await tauriApi.getModelDefaults("llama3");
    expect(invoke).toHaveBeenCalledWith("get_model_defaults", {
      modelName: "llama3",
    });
  });

  it("setModelDefaults calls invoke with modelName and defaults", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.setModelDefaults("llama3", { temperature: 0.8 });
    expect(invoke).toHaveBeenCalledWith("set_model_defaults", {
      modelName: "llama3",
      defaults: { temperature: 0.8 },
    });
  });

  it("searchOllamaLibrary calls invoke with query", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await tauriApi.searchOllamaLibrary("llama");
    expect(invoke).toHaveBeenCalledWith("search_ollama_library", {
      query: "llama",
    });
  });

  // ── Hosts ─────────────────────────────────────────────────────────────────

  it("listHosts calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await tauriApi.listHosts();
    expect(invoke).toHaveBeenCalledWith("list_hosts");
  });

  it("addHost calls invoke with host", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    await tauriApi.addHost({ name: "New", url: "http://new" });
    expect(invoke).toHaveBeenCalledWith("add_host", {
      host: { name: "New", url: "http://new" },
    });
  });

  it("addHostWithDefault calls invoke with newHost payload", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    await tauriApi.addHostWithDefault("New", "http://new", true);
    expect(invoke).toHaveBeenCalledWith("add_host", {
      newHost: { name: "New", url: "http://new", is_default: true },
    });
  });

  it("addHostWithDefault defaults isDefault to false", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    await tauriApi.addHostWithDefault("New", "http://new");
    expect(invoke).toHaveBeenCalledWith("add_host", {
      newHost: { name: "New", url: "http://new", is_default: false },
    });
  });

  it("updateHost calls invoke with host object", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    const host = {
      id: "1",
      name: "H",
      url: "http://h",
      is_active: true,
      status: "online" as const,
      created_at: "",
    };
    await tauriApi.updateHost(host);
    expect(invoke).toHaveBeenCalledWith("update_host", { host });
  });

  it("updateHostFields calls invoke with id/name/url", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.updateHostFields("1", "H2", "http://h2");
    expect(invoke).toHaveBeenCalledWith("update_host", {
      id: "1",
      name: "H2",
      url: "http://h2",
    });
  });

  it("deleteHost calls invoke with id", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.deleteHost("1");
    expect(invoke).toHaveBeenCalledWith("delete_host", { id: "1" });
  });

  it("setActiveHost calls invoke with id", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.setActiveHost("1");
    expect(invoke).toHaveBeenCalledWith("set_active_host", { id: "1" });
  });

  it("pingHost calls invoke with id", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true);
    await tauriApi.pingHost("1");
    expect(invoke).toHaveBeenCalledWith("ping_host", { id: "1" });
  });

  // ── Settings ──────────────────────────────────────────────────────────────

  it("getAllSettings calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({});
    await tauriApi.getAllSettings();
    expect(invoke).toHaveBeenCalledWith("get_all_settings");
  });

  it("getSetting calls invoke with key", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("dark");
    await tauriApi.getSetting("theme");
    expect(invoke).toHaveBeenCalledWith("get_setting", { key: "theme" });
  });

  it("setSetting calls invoke with key and value", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.setSetting("theme", "dark");
    expect(invoke).toHaveBeenCalledWith("set_setting", {
      key: "theme",
      value: "dark",
    });
  });

  it("deleteSetting calls invoke with key", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.deleteSetting("theme");
    expect(invoke).toHaveBeenCalledWith("delete_setting", { key: "theme" });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("login calls invoke with token", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.login("tok123");
    expect(invoke).toHaveBeenCalledWith("login", { token: "tok123" });
  });

  it("loginWithHost calls invoke with hostId and token", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.loginWithHost("h1", "tok123");
    expect(invoke).toHaveBeenCalledWith("login", {
      hostId: "h1",
      token: "tok123",
    });
  });

  it("logout calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.logout();
    expect(invoke).toHaveBeenCalledWith("logout");
  });

  it("logoutHost calls invoke with hostId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.logoutHost("h1");
    expect(invoke).toHaveBeenCalledWith("logout", { hostId: "h1" });
  });

  it("getAuthStatus calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      authenticated: false,
      username: null,
    });
    await tauriApi.getAuthStatus();
    expect(invoke).toHaveBeenCalledWith("get_auth_status");
  });

  it("getHostAuthStatus calls invoke with hostId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(false);
    await tauriApi.getHostAuthStatus("h1");
    expect(invoke).toHaveBeenCalledWith("get_auth_status", { hostId: "h1" });
  });

  it("checkOllamaSignedIn calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true);
    await tauriApi.checkOllamaSignedIn();
    expect(invoke).toHaveBeenCalledWith("check_ollama_signed_in");
  });

  // ── Service ───────────────────────────────────────────────────────────────

  it("startOllama calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.startOllama();
    expect(invoke).toHaveBeenCalledWith("start_ollama");
  });

  it("stopOllama calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.stopOllama();
    expect(invoke).toHaveBeenCalledWith("stop_ollama");
  });

  it("ollamaServiceStatus calls invoke correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("running");
    await tauriApi.ollamaServiceStatus();
    expect(invoke).toHaveBeenCalledWith("ollama_service_status");
  });

  // ── Folders ───────────────────────────────────────────────────────────────

  it("linkFolder calls invoke with conversationId and path", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      id: "f1",
      path: "/docs",
      content: "",
      token_estimate: 0,
    });
    await tauriApi.linkFolder("c1", "/docs");
    expect(invoke).toHaveBeenCalledWith("link_folder", {
      conversationId: "c1",
      path: "/docs",
    });
  });

  it("unlinkFolder calls invoke with id", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.unlinkFolder("f1");
    expect(invoke).toHaveBeenCalledWith("unlink_folder", { id: "f1" });
  });

  it("getFolderContexts calls invoke with conversationId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await tauriApi.getFolderContexts("c1");
    expect(invoke).toHaveBeenCalledWith("get_folder_contexts", {
      conversationId: "c1",
    });
  });

  it("listFolderFiles calls invoke with path", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await tauriApi.listFolderFiles("/docs");
    expect(invoke).toHaveBeenCalledWith("list_folder_files", { path: "/docs" });
  });

  it("updateIncludedFiles calls invoke with id and includedFiles", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ token_estimate: 50, content: "file content" });
    const result = await tauriApi.updateIncludedFiles("f1", ["a.md", "b.md"]);
    expect(invoke).toHaveBeenCalledWith("update_included_files", {
      id: "f1",
      includedFiles: ["a.md", "b.md"],
    });
    expect(result.token_estimate).toBe(50);
    expect(result.content).toBe("file content");
  });

  it("estimateTokens calls invoke with folderId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(512);
    await tauriApi.estimateTokens("f1");
    expect(invoke).toHaveBeenCalledWith("estimate_tokens", { folderId: "f1" });
  });

  // ── System ────────────────────────────────────────────────────────────────

  it("reportActiveView calls invoke with isChatView and conversationId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.reportActiveView(true, "c1");
    expect(invoke).toHaveBeenCalledWith("report_active_view", {
      isChatView: true,
      conversationId: "c1",
    });
  });

  it("openBrowser calls invoke with url", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await tauriApi.openBrowser("https://example.com");
    expect(invoke).toHaveBeenCalledWith("open_browser", {
      url: "https://example.com",
    });
  });

  it("getLibraryModelDetails calls invoke with slug", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      readme: "# Model",
      launch_apps: [],
    });
    await tauriApi.getLibraryModelDetails("llama3");
    expect(invoke).toHaveBeenCalledWith("get_library_model_readme", {
      slug: "llama3",
    });
  });
});
