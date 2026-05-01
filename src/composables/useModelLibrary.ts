import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { LibraryModel, HardwareInfo } from "../types/models";

export function useModelLibrary() {
  const libraryResults = ref<LibraryModel[]>([]);
  const isSearching = ref(false);
  const dynamicCloudModels = ref<LibraryModel[]>([]);
  const isCloudLoading = ref(false);
  const hardware = ref<HardwareInfo | null>(null);

  let searchAbortController: AbortController | null = null;
  let cloudAbortController: AbortController | null = null;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function doSearch(query: string, filter?: string) {
    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();

    if (query.trim().length < 2) {
      libraryResults.value = [];
      return;
    }

    isSearching.value = true;
    try {
      const results = await invoke<LibraryModel[]>("search_ollama_library", {
        query: query.trim(),
        filter: filter ?? null,
      });
      libraryResults.value = results ?? [];
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.warn("Library search failed", err);
        libraryResults.value = [];
      }
    } finally {
      isSearching.value = false;
      searchAbortController = null;
    }
  }

  function scheduleSearch(query: string, filter?: string, debounceMs = 300) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => doSearch(query, filter), debounceMs);
  }

  async function fetchCloudModels() {
    if (cloudAbortController) cloudAbortController.abort();
    cloudAbortController = new AbortController();

    isCloudLoading.value = true;
    try {
      const results = await invoke<LibraryModel[]>("search_ollama_library", {
        query: "",
        filter: "cloud",
      });
      dynamicCloudModels.value = results ?? [];
    } catch (err) {
      console.warn("Cloud model fetch failed", err);
      dynamicCloudModels.value = [];
    } finally {
      isCloudLoading.value = false;
      cloudAbortController = null;
    }
  }

  async function detectHardware() {
    try {
      hardware.value = await invoke<HardwareInfo>("detect_hardware");
    } catch (err) {
      console.warn("Hardware detection failed", err);
    }
  }

  function cancelSearch() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (searchAbortController) {
      searchAbortController.abort();
      searchAbortController = null;
    }
  }

  return {
    libraryResults,
    isSearching,
    dynamicCloudModels,
    isCloudLoading,
    hardware,
    doSearch,
    scheduleSearch,
    fetchCloudModels,
    detectHardware,
    cancelSearch,
  };
}
