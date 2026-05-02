<template>
  <div class="flex flex-col gap-[8px]">
    <SettingsRow icon="folder">
      <template #label>Model location</template>
      <template #subtitle>Location where models are stored.</template>
      <template #control>
        <input
          v-model="settingsStore.modelPath"
          @change="applyModelPath(settingsStore.modelPath)"
          placeholder="~/.ollama/models"
          class="custom-input w-52 font-mono"
        />
        <button
          @click="browseModelPath"
          class="px-3 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-[12px] text-[var(--text)] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
        >
          Browse
        </button>
      </template>
    </SettingsRow>

    <!-- Model path status panel -->
    <div
      v-if="pathValidation.status !== 'idle' || pathApply.status !== 'idle'"
      class="flex flex-col gap-1 px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11.5px]"
    >
      <!-- Validation feedback -->
      <div
        v-if="pathValidation.status === 'checking'"
        class="flex items-center gap-1.5 text-[var(--text-dim)]"
      >
        <svg
          class="animate-spin w-3 h-3 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Checking path…
      </div>
      <div
        v-else-if="pathValidation.status === 'error'"
        class="flex items-center gap-1.5 text-[var(--danger)]"
      >
        <span class="flex-shrink-0">⚠</span>
        {{ pathValidation.message }}
      </div>
      <div
        v-else-if="pathValidation.status === 'warning'"
        class="flex items-center gap-1.5 text-amber-500"
      >
        <span class="flex-shrink-0">⚠</span>
        {{ pathValidation.message }}
      </div>
      <div
        v-else-if="pathValidation.status === 'ok'"
        class="flex items-center gap-1.5 text-[var(--accent)]"
      >
        <span class="flex-shrink-0">✓</span>
        {{ pathValidation.message }}
      </div>

      <!-- Apply feedback -->
      <div
        v-if="pathApply.status === 'applying'"
        class="flex items-center gap-1.5 text-[var(--text-dim)]"
      >
        <svg
          class="animate-spin w-3 h-3 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Applying…
      </div>
      <div
        v-else-if="pathApply.status === 'success'"
        class="flex items-center gap-1.5 text-[var(--accent)]"
      >
        <span class="flex-shrink-0">✓</span>
        {{ pathApply.message }}
      </div>
      <div
        v-else-if="pathApply.status === 'error'"
        class="flex items-center gap-1.5 text-[var(--danger)]"
      >
        <span class="flex-shrink-0">✗</span>
        {{ pathApply.message }}
      </div>
      <div
        v-else-if="pathApply.status === 'manual'"
        class="text-[var(--text-dim)]"
      >
        {{ pathApply.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import SettingsRow from "./SettingsRow.vue";
import { useSettingsStore } from "../../stores/settings";
import { useModelStore } from "../../stores/models";
import { useHostStore } from "../../stores/hosts";
import { extractErrorMessage } from "../../lib/tauri";

interface ModelPathInfo {
  resolved_path: string;
  exists: boolean;
  accessible: boolean;
  model_count: number;
}

interface ApplyModelPathResult {
  service_type: string;
  applied: boolean;
  restarted: boolean;
  message: string;
}

interface ModelPathValidation {
  status: "idle" | "checking" | "ok" | "warning" | "error";
  message: string;
  modelCount: number;
}

interface ModelPathApply {
  status: "idle" | "applying" | "success" | "error" | "manual";
  message: string;
}

const settingsStore = useSettingsStore();
const modelsStore = useModelStore();
const hostStore = useHostStore();

const pathValidation = ref<ModelPathValidation>({
  status: "idle",
  message: "",
  modelCount: 0,
});

const pathApply = ref<ModelPathApply>({
  status: "idle",
  message: "",
});

let _validateTimer: ReturnType<typeof setTimeout> | null = null;
const _restartTimers: ReturnType<typeof setTimeout>[] = [];

watch(
  () => settingsStore.modelPath,
  (newPath) => {
    if (_validateTimer) clearTimeout(_validateTimer);
    if (!newPath) {
      pathValidation.value = { status: "idle", message: "", modelCount: 0 };
      return;
    }
    pathValidation.value = { ...pathValidation.value, status: "checking" };
    _validateTimer = setTimeout(async () => {
      try {
        const info = await invoke<ModelPathInfo>("validate_model_path", {
          path: newPath,
        });
        if (!info.exists) {
          pathValidation.value = {
            status: "error",
            message: "Path does not exist",
            modelCount: 0,
          };
        } else if (!info.accessible) {
          pathValidation.value = {
            status: "warning",
            message:
              "System path — Alpaka will request elevated access to configure Ollama",
            modelCount: 0,
          };
        } else if (info.model_count === 0) {
          pathValidation.value = {
            status: "warning",
            message:
              "No Ollama models found here — your current models won't be accessible at this location",
            modelCount: 0,
          };
        } else {
          pathValidation.value = {
            status: "ok",
            message: `Found ${info.model_count} model(s)`,
            modelCount: info.model_count,
          };
        }
      } catch (err) {
        console.error("Model path validation failed:", err);
        pathValidation.value = {
          status: "error",
          message: "Validation failed",
          modelCount: 0,
        };
      }
    }, 500);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (_validateTimer) clearTimeout(_validateTimer);
  _restartTimers.forEach(clearTimeout);
});

async function applyModelPath(path: string) {
  pathApply.value = { status: "applying", message: "" };
  try {
    const result = await invoke<ApplyModelPathResult>("apply_model_path", {
      path,
    });
    if (result.service_type === "none") {
      pathApply.value = { status: "manual", message: result.message };
    } else {
      pathApply.value = { status: "success", message: result.message };
      if (result.restarted) {
        const ensureLocalHost = async () => {
          await hostStore.fetchHosts();
          const active = hostStore.activeHost;
          if (active && active.kind === "cloud") {
            const local = hostStore.hosts.find((h) => h.kind === "local");
            if (local) await hostStore.setActiveHost(local.id);
          }
        };
        _restartTimers.push(
          setTimeout(async () => {
            await ensureLocalHost();
            modelsStore.fetchModels();
          }, 2000),
          setTimeout(() => modelsStore.fetchModels(), 5000),
        );
      }
    }
  } catch (err: unknown) {
    pathApply.value = { status: "error", message: extractErrorMessage(err) };
  }
}

async function browseModelPath() {
  try {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      settingsStore.modelPath = selected;
      await applyModelPath(selected);
    }
  } catch (err) {
    console.error("Failed to pick directory:", err);
    pathApply.value = {
      status: "error",
      message: "Could not open directory picker",
    };
  }
}
</script>

<style scoped>
.custom-input {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
  transition: all 0.2s;
}
.custom-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-muted);
}
</style>
