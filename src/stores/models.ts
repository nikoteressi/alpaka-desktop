import { defineStore } from "pinia";

// Module-level helper — not part of store state. Used by ModelsPage and ModelSelector.
export function modelMatchesTag(
  modelName: string,
  tag: string,
  userDataMap: Record<string, { tags: string[] }>,
  caps:
    | {
        vision?: boolean;
        tools?: boolean;
        thinking?: boolean;
        embedding?: boolean;
        cloud?: boolean;
        audio?: boolean;
      }
    | null
    | undefined,
): boolean {
  if (userDataMap[modelName]?.tags.includes(tag)) return true;
  if (!caps) return false;
  if (tag === "vision") return !!caps.vision;
  if (tag === "tools") return !!caps.tools;
  if (tag === "thinking") return !!caps.thinking;
  if (tag === "embed") return !!caps.embedding;
  if (tag === "cloud") return !!caps.cloud;
  if (tag === "audio") return !!caps.audio;
  return false;
}
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { extractErrorMessage } from "../lib/tauri";
import type {
  Model,
  PullProgressPayload,
  PushProgressPayload,
  LibraryModel,
  ModelCapabilities,
  LibraryTag,
  LaunchApp,
  ModelUserData,
  CreateState,
  CreateProgressPayload,
  CreateDonePayload,
  CreateErrorPayload,
  ModelUpdatesCheckedPayload,
} from "../types/models";

export type { ModelCapabilities };

export const useModelStore = defineStore("models", {
  state: () => ({
    models: [] as Model[],
    pulling: {} as Record<string, PullProgressPayload>,
    pushing: {} as Record<string, PushProgressPayload>,
    creating: {} as Record<string, CreateState>,
    isLoading: false,
    error: null as string | null,
    listenersInitialized: false,
    _unlisten: [] as Array<() => void>,
    capabilities: {} as Record<string, ModelCapabilities>,
    modelUserData: {} as Record<string, ModelUserData>,
    // Library search state
    libraryResults: [] as LibraryModel[],
    searchQuery: "",
    isSearching: false,
    _searchTimer: null as ReturnType<typeof setTimeout> | null,
    _searchVersion: 0,
    modelsWithUpdates: new Set<string>(),
    isCheckingUpdates: false,
    // Details view state
    selectedModel: null as LibraryModel | null,
    selectedModelTags: [] as LibraryTag[],
    isLoadingDetails: false,
  }),
  getters: {
    /** Names of all locally installed models */
    installedModelNames: (state) => state.models.map((m) => m.name),
    /** Check if a model name is installed locally */
    isInstalled: (state) => (name: string) =>
      state.models.some(
        (m) => m.name === name || m.name.startsWith(name + ":"),
      ),
    /** Models sorted with favorites first, preserving relative order otherwise */
    sortedModels: (state) => {
      return [...state.models].sort((a, b) => {
        const aFav = state.modelUserData[a.name]?.isFavorite ?? false;
        const bFav = state.modelUserData[b.name]?.isFavorite ?? false;
        if (aFav !== bFav) return aFav ? -1 : 1;
        return 0;
      });
    },
    isFavorite: (state) => (name: string) =>
      state.modelUserData[name]?.isFavorite ?? false,
    getUserTags: (state) => (name: string) =>
      state.modelUserData[name]?.tags ?? [],
    allUserTags: (state) => {
      const tagSet = new Set<string>();
      Object.values(state.modelUserData).forEach((d) =>
        d.tags.forEach((t) => tagSet.add(t)),
      );
      return [...tagSet].sort((a, b) => a.localeCompare(b));
    },
    allFilterableTags: (state) => {
      const tagSet = new Set<string>();
      // User-defined tags
      Object.values(state.modelUserData).forEach((d) =>
        d.tags.forEach((t) => tagSet.add(t)),
      );
      // Ollama capability tags present on at least one installed model
      Object.values(state.capabilities).forEach((caps) => {
        if (caps.vision) tagSet.add("vision");
        if (caps.tools) tagSet.add("tools");
        if (caps.thinking) tagSet.add("thinking");
        if (caps.embedding) tagSet.add("embed");
        if (caps.cloud) tagSet.add("cloud");
        if (caps.audio) tagSet.add("audio");
      });
      return [...tagSet].sort((a, b) => a.localeCompare(b));
    },
    hasUpdate: (state) => (name: string) => state.modelsWithUpdates.has(name),
    updatesAvailableCount: (state) => state.modelsWithUpdates.size,
  },
  actions: {
    async fetchModels() {
      this.isLoading = true;
      this.error = null;
      try {
        const models = await invoke<Model[]>("list_models");
        this.models = models;

        this.fetchModelUserData();

        // Fetch capabilities for all models in parallel
        Promise.all(models.map((m) => this.fetchCapabilities(m.name))).catch(
          (err) =>
            console.error("Failed to fetch capabilities for some models:", err),
        );
      } catch (e: unknown) {
        // Tauri AppError serializes as a tagged object e.g. {"Http":"connection refused"}.
        // Check instanceof Error first since Error properties are non-enumerable.
        if (e instanceof Error) {
          this.error = e.message;
        } else if (e && typeof e === "object" && !Array.isArray(e)) {
          const entries = Object.entries(e as Record<string, unknown>);
          this.error =
            entries.length > 0
              ? entries.map(([k, v]) => `${k}: ${v}`).join("; ")
              : JSON.stringify(e);
        } else {
          this.error = String(e);
        }
        console.error("[models] fetchModels failed:", e);
      } finally {
        this.isLoading = false;
      }
    },

    async fetchModelUserData(): Promise<void> {
      try {
        const rows = await invoke<
          Array<{ name: string; is_favorite: boolean; tags: string[] }>
        >("list_model_user_data");
        const map: Record<string, ModelUserData> = {};
        for (const row of rows) {
          map[row.name] = {
            name: row.name,
            isFavorite: row.is_favorite,
            tags: row.tags,
          };
        }
        this.modelUserData = map;
      } catch (e) {
        console.error("[models] fetchModelUserData failed:", e);
      }
    },

    async toggleFavorite(name: string): Promise<void> {
      try {
        const newState = await invoke<boolean>("toggle_model_favorite", {
          name,
        });
        if (this.modelUserData[name]) {
          this.modelUserData[name].isFavorite = newState;
        } else {
          this.modelUserData[name] = { name, isFavorite: newState, tags: [] };
        }
      } catch (e) {
        console.error("[models] toggleFavorite failed:", e);
      }
    },

    async setModelTags(name: string, tags: string[]): Promise<void> {
      try {
        await invoke<void>("set_model_tags", { name, tags });
        if (this.modelUserData[name]) {
          this.modelUserData[name].tags = tags;
        } else {
          this.modelUserData[name] = { name, isFavorite: false, tags };
        }
      } catch (e) {
        console.error("[models] setModelTags failed:", e);
      }
    },

    async fetchCapabilities(modelName: string) {
      if (this.capabilities[modelName]) return this.capabilities[modelName];
      try {
        const caps = await invoke<ModelCapabilities>("get_model_capabilities", {
          name: modelName,
        });
        this.capabilities[modelName] = caps;
        return caps;
      } catch {
        return null;
      }
    },

    getCapabilities(modelName: string): ModelCapabilities | null {
      return this.capabilities[modelName] ?? null;
    },
    async deleteModel(name: string): Promise<void> {
      try {
        await invoke<void>("delete_model", { name });
        this.models = this.models.filter((m) => m.name !== name);
        // Also clean up capabilities cache for the deleted model
        if (this.capabilities) {
          delete this.capabilities[name];
        }
      } catch (e: unknown) {
        const errorMsg = extractErrorMessage(e);
        this.error = errorMsg;
        throw new Error(`Failed to delete model "${name}": ${errorMsg}`);
      }
    },
    async pullModel(name: string) {
      if (this.pulling[name]) return; // Already pulling
      this.pulling[name] = { model: name, status: "starting...", percent: 0 };
      try {
        await invoke("pull_model", { name });
      } catch (e: unknown) {
        this.error = extractErrorMessage(e);
        delete this.pulling[name];
      }
    },
    async pushModel(name: string) {
      if (this.pushing[name]) return;
      this.pushing[name] = { model: name, status: "starting...", percent: 0 };
      try {
        await invoke("push_model", { name });
      } finally {
        delete this.pushing[name];
      }
    },
    /**
     * Ensures a cloud model is available by pulling it if not already installed.
     */
    async fetchLibraryTags(slug: string): Promise<string[]> {
      try {
        const tags = await invoke<LibraryTag[]>("get_library_tags", { slug });
        return tags.map((t) => t.name);
      } catch (e) {
        console.error(`Failed to fetch tags for ${slug}`, e);
        return [];
      }
    },

    async addCloudModel(name: string) {
      if (!this.isInstalled(name)) {
        await this.pullModel(name);
      }
    },
    async fetchLibraryModelDetails(slug: string) {
      this.isLoadingDetails = true;
      try {
        const details = await invoke<{
          readme: string;
          launch_apps: LaunchApp[];
        }>("get_library_model_readme", { slug });
        if (this.selectedModel && this.selectedModel.slug === slug) {
          this.selectedModel.readme = details.readme;
          this.selectedModel.launch_apps = details.launch_apps;
        }
      } catch (e) {
        console.error("Failed to fetch model details:", e);
      } finally {
        this.isLoadingDetails = false;
      }
    },
    async fetchLibraryTagsDetailed(slug: string) {
      try {
        this.selectedModelTags = await invoke<LibraryTag[]>(
          "get_library_tags",
          { slug },
        );
      } catch (e) {
        console.error("Failed to fetch detailed tags:", e);
        this.selectedModelTags = [];
      }
    },
    /** Search the Ollama library for models (debounced) */
    searchLibrary(query: string) {
      this.searchQuery = query;
      if (this._searchTimer) clearTimeout(this._searchTimer);
      const q = query.trim();
      if (!q) {
        this.libraryResults = [];
        this.isSearching = false;
        return;
      }
      this.isSearching = true;
      this._searchVersion++;
      const version = this._searchVersion;
      this._searchTimer = setTimeout(async () => {
        try {
          const results = await invoke<LibraryModel[]>(
            "search_ollama_library",
            { query: q },
          );
          if (version === this._searchVersion) {
            this.libraryResults = results;
          }
        } catch (err) {
          if (version === this._searchVersion) {
            console.error("Library search failed:", err);
            this.libraryResults = [];
          }
        } finally {
          if (version === this._searchVersion) {
            this.isSearching = false;
          }
        }
      }, 300);
    },
    clearLibrarySearch() {
      this.searchQuery = "";
      this.libraryResults = [];
      this.isSearching = false;
      if (this._searchTimer) clearTimeout(this._searchTimer);
    },
    async fetchInitialUpdateStatus(): Promise<void> {
      try {
        const outdated = await invoke<string[]>("get_models_with_updates");
        this.modelsWithUpdates = new Set(outdated);
      } catch (e) {
        console.error("[models] fetchInitialUpdateStatus failed:", e);
      }
    },

    async triggerUpdateCheck(): Promise<void> {
      if (this.isCheckingUpdates) return;
      this.isCheckingUpdates = true;
      try {
        await invoke("check_model_updates");
      } catch (e) {
        console.error("[models] triggerUpdateCheck failed:", e);
        this.isCheckingUpdates = false;
      }
    },
    async initListeners() {
      if (this.listenersInitialized) return;
      const unlistens: Array<() => void> = [];
      try {
        unlistens.push(
          ...(await Promise.all([
            listen<PullProgressPayload>("model:pull-progress", (event) => {
              const payload = event.payload;
              this.pulling[payload.model] = payload;
            }),
            listen<{ model: string }>("model:pull-done", (event) => {
              const payload = event.payload;
              delete this.pulling[payload.model];
              this.modelsWithUpdates.delete(payload.model);
              this.fetchModels();
              this.fetchCapabilities(payload.model);
            }),
            listen<CreateProgressPayload>("model:create-progress", (event) => {
              const { model, status } = event.payload;
              if (this.creating[model]) {
                this.creating[model].status = status;
                this.creating[model].logLines.push(status);
              }
            }),
            listen<CreateDonePayload>("model:create-done", (event) => {
              const { model } = event.payload;
              if (this.creating[model]) {
                this.creating[model].phase = "done";
              }
              this.fetchModels();
            }),
            listen<CreateErrorPayload>("model:create-error", (event) => {
              const { model, error, cancelled } = event.payload;
              if (this.creating[model]) {
                if (cancelled) {
                  // No reason to keep cancelled state in memory — delete immediately.
                  // CreateModelPage captures the phase locally before this fires.
                  delete this.creating[model];
                } else {
                  this.creating[model].phase = "error";
                  this.creating[model].error = error;
                }
              }
            }),
            listen<ModelUpdatesCheckedPayload>(
              "model:updates-checked",
              (event) => {
                this.modelsWithUpdates = new Set(event.payload.outdated);
                this.isCheckingUpdates = false;
              },
            ),
            listen<PushProgressPayload>("model:push-progress", (event) => {
              const payload = event.payload;
              this.pushing[payload.model] = payload;
            }),
            listen<{ model: string }>("model:push-done", (event) => {
              const { model } = event.payload;
              delete this.pushing[model];
              this.fetchModels();
            }),
            listen<{ model: string; error: string }>(
              "model:push-error",
              (event) => {
                const { model } = event.payload;
                delete this.pushing[model];
              },
            ),
          ])),
        );
        this._unlisten = unlistens;
        this.listenersInitialized = true;
      } catch (e) {
        unlistens.forEach((fn) => fn());
        // listenersInitialized stays false — retry is possible
        throw e;
      }
    },

    clearCreateState(name: string) {
      delete this.creating[name];
    },

    formatBytes(bytes: number) {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (
        Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
      );
    },
  },
});
