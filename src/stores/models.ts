import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Model, PullProgressPayload, LibraryModel, ModelCapabilities, PullHistoryEntry, LibraryTag, LaunchApp } from '../types/models';

export type { ModelCapabilities };


export const useModelStore = defineStore('models', {
  state: () => ({
    models: [] as Model[],
    pulling: {} as Record<string, PullProgressPayload>,
    isLoading: false,
    error: null as string | null,
    listenersInitialized: false,
    capabilities: {} as Record<string, ModelCapabilities>,
    // Library search state
    libraryResults: [] as LibraryModel[],
    pullHistory: [] as PullHistoryEntry[],
    searchQuery: '',
    isSearching: false,
    _searchTimer: null as ReturnType<typeof setTimeout> | null,
    // Details view state
    selectedModel: null as LibraryModel | null,
    selectedModelTags: [] as LibraryTag[],
    isLoadingDetails: false,
  }),
  getters: {
    /** Names of all locally installed models */
    installedModelNames: (state) => state.models.map(m => m.name),
    /** Check if a model name is installed locally */
    isInstalled: (state) => (name: string) =>
      state.models.some(m => m.name === name || m.name.startsWith(name + ':')),
  },
  actions: {
    async fetchModels() {
      this.isLoading = true;
      this.error = null;
      try {
        const models = await invoke<Model[]>('list_models');
        this.models = models;

        // Fetch capabilities for all models in parallel
        Promise.all(models.map(m => this.fetchCapabilities(m.name)))
          .catch(err => console.error('Failed to fetch capabilities for some models:', err));
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : String(e);
      } finally {
        this.isLoading = false;
      }
    },

    async fetchCapabilities(modelName: string) {
      if (this.capabilities[modelName]) return this.capabilities[modelName]
      try {
        const caps = await invoke<ModelCapabilities>('get_model_capabilities', { name: modelName })
        this.capabilities[modelName] = caps
        return caps
      } catch {
        return null
      }
    },


    getCapabilities(modelName: string): ModelCapabilities | null {
      return this.capabilities[modelName] ?? null
    },
    async deleteModel(name: string): Promise<void> {
      try {
        await invoke<void>('delete_model', { name });
        this.models = this.models.filter(m => m.name !== name);
        // Also clean up capabilities cache for the deleted model
        if (this.capabilities) {
          delete this.capabilities[name];
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        this.error = errorMsg;
        throw new Error(`Failed to delete model "${name}": ${errorMsg}`);
      }
    },
    async pullModel(name: string) {
      if (this.pulling[name]) return; // Already pulling
      this.pulling[name] = { model: name, status: 'starting...', percent: 0 };
      try {
        await invoke('pull_model', { name });
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : String(e);
        delete this.pulling[name];
      }
    },
    /**
     * Ensures a cloud model is available by pulling it if not already installed.
     */
    async fetchLibraryTags(slug: string): Promise<string[]> {
      try {
        const tags = await invoke<LibraryTag[]>('get_library_tags', { slug });
        return tags.map(t => t.name);
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
        const details = await invoke<{ readme: string, launch_apps: LaunchApp[] }>('get_library_model_readme', { slug });
        if (this.selectedModel && this.selectedModel.slug === slug) {
          this.selectedModel.readme = details.readme;
          this.selectedModel.launch_apps = details.launch_apps;
        }
      } catch (e) {
        console.error('Failed to fetch model details:', e);
      } finally {
        this.isLoadingDetails = false;
      }
    },
    async fetchLibraryTagsDetailed(slug: string) {
      try {
        this.selectedModelTags = await invoke<LibraryTag[]>('get_library_tags', { slug });
      } catch (e) {
        console.error('Failed to fetch detailed tags:', e);
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
      this._searchTimer = setTimeout(async () => {
        try {
          this.libraryResults = await invoke<LibraryModel[]>('search_ollama_library', { query: q });
        } catch (err) {
          console.error('Library search failed:', err);
          this.libraryResults = [];
        } finally {
          this.isSearching = false;
        }
      }, 300);
    },
    clearLibrarySearch() {
      this.searchQuery = '';
      this.libraryResults = [];
      this.isSearching = false;
      if (this._searchTimer) clearTimeout(this._searchTimer);
    },
    async initListeners() {
      if (this.listenersInitialized) return;
      this.listenersInitialized = true;

      this.fetchPullHistory();

      await listen<PullProgressPayload>('model:pull-progress', (event) => {
        const payload = event.payload;
        this.pulling[payload.model] = payload;
        // Optionally refresh history during pull if status changes significantly
      });
      await listen<{ model: string }>('model:pull-done', (event) => {
        const payload = event.payload;
        delete this.pulling[payload.model];
        this.fetchModels(); // Refresh list automatically
        this.fetchPullHistory(); // Also refresh history
        this.fetchCapabilities(payload.model); // Re-fetch capabilities now that it's ready
      });
    },

    async fetchPullHistory() {
      try {
        this.pullHistory = await invoke<PullHistoryEntry[]>('get_pull_history');
      } catch (err) {
        console.error('Failed to fetch pull history:', err);
      }
    },

    formatBytes(bytes: number) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }
});
