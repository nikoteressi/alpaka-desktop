<template>
  <div class="h-full overflow-y-auto px-6 py-5 no-scrollbar">
    <div class="max-w-[620px] mx-auto">
      <!-- Header row -->
      <div class="flex items-center gap-3 mb-1">
        <h1 class="text-[17px] font-bold text-[var(--text-heading)]">
          Settings
        </h1>
      </div>

      <!-- Glassy Horizontal Tabs -->
      <AppTabs v-model="activeTab" :tabs="tabs" />

      <div class="flex flex-col gap-[8px]">
        <!-- General Section -->
        <Transition name="fade-slide" mode="out-in">
          <div
            v-if="activeTab === 'general'"
            key="general"
            class="flex flex-col gap-[8px]"
          >
            <SettingsRow icon="cloud">
              <template #label>Cloud</template>
              <template #subtitle>Enable cloud models and web search.</template>
              <template #control>
                <ToggleSwitch
                  :value="settingsStore.cloud"
                  @change="settingsStore.updateSetting('cloud', $event)"
                />
              </template>
            </SettingsRow>

            <SettingsRow icon="download">
              <template #label>Auto-download updates</template>
              <template #control>
                <ToggleSwitch
                  :value="settingsStore.autoUpdate"
                  @change="settingsStore.updateSetting('autoUpdate', $event)"
                />
              </template>
            </SettingsRow>

            <SettingsRow icon="activity">
              <template #label>Performance statistics</template>
              <template #subtitle
                >Show speed and token counts for every response.</template
              >
              <template #control>
                <ToggleSwitch
                  :value="settingsStore.showPerformanceMetrics"
                  @change="
                    settingsStore.updateSetting(
                      'showPerformanceMetrics',
                      $event,
                    )
                  "
                />
              </template>
            </SettingsRow>

            <SettingsRow icon="bell">
              <template #label>Desktop Notifications</template>
              <template #subtitle
                >Get notified when models finish downloading or errors
                occur.</template
              >
              <template #control>
                <ToggleSwitch
                  :value="settingsStore.notificationsEnabled"
                  @change="
                    settingsStore.updateSetting('notificationsEnabled', $event)
                  "
                />
              </template>
            </SettingsRow>

            <!-- Appearance / Theme Picker -->
            <div class="settings-card">
              <div>
                <p class="text-[13.5px] font-bold text-[var(--text)]">
                  Appearance
                </p>
                <p class="text-[12px] mt-0.5 text-[var(--text-dim)]">
                  Choose how Ollama looks on your device.
                </p>
              </div>
              <div class="flex gap-3">
                <button
                  v-for="opt in themeOptions"
                  :key="opt.id"
                  class="theme-option flex-1 flex flex-col items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all"
                  :class="
                    settingsStore.theme === opt.id
                      ? 'theme-option--active'
                      : 'theme-option--inactive'
                  "
                  @click="settingsStore.setTheme(opt.id)"
                >
                  <!-- Mini preview -->
                  <div
                    class="w-full h-14 rounded-lg overflow-hidden border border-[var(--border)]"
                    :style="previewStyle(opt.id)"
                  >
                    <div class="flex h-full">
                      <!-- Sidebar strip -->
                      <div
                        class="w-1/4 h-full border-r border-[var(--border-subtle)]"
                        :style="previewSidebarStyle(opt.id)"
                      />
                      <!-- Content area -->
                      <div
                        class="flex-1 p-1.5 flex flex-col gap-1 justify-center opacity-40"
                      >
                        <div
                          class="h-1.5 rounded-full w-3/4"
                          :style="previewLineStyle(opt.id, true)"
                        />
                        <div
                          class="h-1.5 rounded-full w-1/2"
                          :style="previewLineStyle(opt.id, false)"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-col items-center gap-0.5">
                    <span
                      class="text-[12px] font-bold"
                      :class="
                        settingsStore.theme === opt.id
                          ? 'text-[var(--accent)]'
                          : 'text-[var(--text)]'
                      "
                      >{{ opt.label }}</span
                    >
                    <span class="text-[11px] text-[var(--text-dim)]">{{
                      opt.sub
                    }}</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Danger Zone -->
            <div
              class="mt-8 flex items-center justify-between px-4 py-3.5 bg-[var(--danger-muted)] border border-[var(--danger)]/20 rounded-xl gap-3"
            >
              <div>
                <p class="text-[13px] font-bold text-[var(--text)]">
                  Reset to defaults
                </p>
                <p class="text-[11px] mt-0.5 text-[var(--text-dim)]">
                  This will reset all your settings to their original values.
                </p>
              </div>
              <button
                @click="confirmReset"
                class="px-4 py-1.5 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg text-[var(--danger)] text-[12px] font-bold cursor-pointer hover:bg-[var(--danger)] hover:text-white transition-all"
              >
                Reset all
              </button>
            </div>
          </div>

          <!-- Connectivity Section -->
          <div
            v-else-if="activeTab === 'connectivity'"
            key="connectivity"
            class="flex flex-col gap-[8px]"
          >
            <HostSettings />

            <SettingsRow icon="globe">
              <template #label>Ollama server URL</template>
              <template #control>
                <input
                  v-model="settingsStore.serverUrl"
                  @change="
                    settingsStore.updateSetting(
                      'serverUrl',
                      settingsStore.serverUrl,
                    )
                  "
                  class="custom-input w-52 font-mono"
                />
              </template>
            </SettingsRow>

            <SettingsRow icon="wifi">
              <template #label>Expose Ollama to network</template>
              <template #control>
                <ToggleSwitch
                  :value="settingsStore.exposeNetwork"
                  @change="settingsStore.updateSetting('exposeNetwork', $event)"
                />
              </template>
            </SettingsRow>
          </div>

          <!-- Models Section -->
          <div
            v-else-if="activeTab === 'models'"
            key="models"
            class="flex flex-col gap-[8px]"
          >
            <SettingsRow icon="folder">
              <template #label>Model location</template>
              <template #subtitle>Location where models are stored.</template>
              <template #control>
                <input
                  v-model="settingsStore.modelPath"
                  @change="
                    settingsStore.updateSetting(
                      'modelPath',
                      settingsStore.modelPath,
                    )
                  "
                  placeholder="~/.ollama/models"
                  class="custom-input w-36 font-mono"
                />
                <button
                  @click="browseModelPath"
                  class="px-3 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-[12px] text-[var(--text)] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
                >
                  Browse
                </button>
              </template>
            </SettingsRow>

            <SettingsRow icon="layout">
              <template #label>Context length</template>
              <template #subtitle
                >{{
                  settingsStore.chatOptions.num_ctx.toLocaleString()
                }}
                tokens</template
              >
              <template #control>
                <div class="w-40">
                  <input
                    type="range"
                    :min="0"
                    :max="CTX_STEPS.length - 1"
                    :value="ctxStepIndex"
                    @input="onCtxSlider"
                    class="w-full accent-[var(--accent)] h-1.5 bg-[var(--bg-active)] rounded-lg appearance-none cursor-pointer"
                  />
                  <div
                    class="flex justify-between text-[10px] mt-1.5 text-[var(--text-dim)] font-bold"
                  >
                    <span>4K</span>
                    <span>256K</span>
                  </div>
                </div>
              </template>
            </SettingsRow>

            <div class="mt-4 mb-2">
              <h2
                class="text-[13px] font-bold text-[var(--text-heading)] uppercase tracking-wider opacity-60"
              >
                Global Model Parameters
              </h2>
            </div>

            <!-- Temperature -->
            <SettingsRow icon="sliders">
              <template #label>Temperature</template>
              <template #subtitle
                >Higher = creative & random; Lower = focused &
                deterministic.</template
              >
              <template #control>
                <div class="w-40">
                  <SettingsSlider
                    label="Temperature"
                    :model-value="settingsStore.chatOptions.temperature"
                    @update:model-value="
                      settingsStore.updateChatOptions({ temperature: $event })
                    "
                    :min="0"
                    :max="1"
                    :step="0.1"
                  />
                </div>
              </template>
            </SettingsRow>

            <!-- Top P -->
            <SettingsRow icon="sliders">
              <template #label>Top P</template>
              <template #subtitle
                >Filters choices by cumulative probability. Lower values focus
                on the most likely words.</template
              >
              <template #control>
                <div class="w-40">
                  <SettingsSlider
                    label="Top P"
                    :model-value="settingsStore.chatOptions.top_p"
                    @update:model-value="
                      settingsStore.updateChatOptions({ top_p: $event })
                    "
                    :min="0"
                    :max="1"
                    :step="0.05"
                  />
                </div>
              </template>
            </SettingsRow>

            <!-- Top K -->
            <SettingsRow icon="sliders">
              <template #label>Top K</template>
              <template #subtitle
                >Limits the model to the K most likely words. Prevents
                "hallucinating" rare words.</template
              >
              <template #control>
                <div class="w-40">
                  <SettingsSlider
                    label="Top K"
                    :model-value="settingsStore.chatOptions.top_k"
                    @update:model-value="
                      settingsStore.updateChatOptions({ top_k: $event })
                    "
                    :min="0"
                    :max="100"
                    :step="1"
                  />
                </div>
              </template>
            </SettingsRow>

            <!-- Repeat Penalty -->
            <SettingsRow icon="sliders">
              <template #label>Repeat Penalty</template>
              <template #subtitle
                >Prevents word/phrase repetition. 1.0 = Disable, 1.1-1.2 =
                Recommended.</template
              >
              <template #control>
                <div class="w-40">
                  <SettingsSlider
                    label="Repeat Penalty"
                    :model-value="settingsStore.chatOptions.repeat_penalty"
                    @update:model-value="
                      settingsStore.updateChatOptions({
                        repeat_penalty: $event,
                      })
                    "
                    :min="1"
                    :max="2"
                    :step="0.05"
                  />
                </div>
              </template>
            </SettingsRow>

            <!-- Repeat Last N -->
            <SettingsRow icon="sliders">
              <template #label>Repeat Last N</template>
              <template #subtitle
                >How far back the model looks to detect and prevent repetition.
                Higher = more previous words are checked.</template
              >
              <template #control>
                <div class="w-40">
                  <SettingsSlider
                    label="Repeat Last N"
                    :model-value="settingsStore.chatOptions.repeat_last_n"
                    @update:model-value="
                      settingsStore.updateChatOptions({ repeat_last_n: $event })
                    "
                    :min="0"
                    :max="128"
                    :step="8"
                  />
                </div>
              </template>
            </SettingsRow>
          </div>

          <!-- Prompts Section -->
          <div
            v-else-if="activeTab === 'prompts'"
            key="prompts"
            class="flex flex-col gap-5 px-1"
          >
            <div class="mb-1">
              <h2 class="text-[14px] font-bold text-[var(--text-heading)]">
                System Instructions
              </h2>
              <p class="text-[12.1px] mt-1 text-[var(--text-dim)]">
                Configure global prompts and functional templates.
              </p>
            </div>

            <!-- Global System Prompt -->
            <div class="settings-card gap-2.5">
              <p class="text-[13.5px] font-bold text-[var(--text)]">
                Global System Prompt
              </p>
              <textarea
                v-model="settingsStore.globalSystemPrompt"
                @change="
                  settingsStore.updateSetting(
                    'globalSystemPrompt',
                    settingsStore.globalSystemPrompt,
                  )
                "
                placeholder="e.g. Always respond in a friendly tone..."
                class="custom-textarea h-32"
              ></textarea>
            </div>

            <!-- Formatting Template -->
            <div class="settings-card gap-2.5">
              <div class="flex items-center justify-between">
                <p class="text-[13.5px] font-bold text-[var(--text)]">
                  Standard Formatting (Markdown)
                </p>
                <ToggleSwitch
                  :value="settingsStore.systemFormattingEnabled"
                  @change="
                    settingsStore.updateSetting(
                      'systemFormattingEnabled',
                      $event,
                    )
                  "
                />
              </div>
              <textarea
                v-model="settingsStore.systemFormattingTemplate"
                @change="
                  settingsStore.updateSetting(
                    'systemFormattingTemplate',
                    settingsStore.systemFormattingTemplate,
                  )
                "
                class="custom-textarea h-20 font-mono text-[11px]"
                :disabled="!settingsStore.systemFormattingEnabled"
              ></textarea>
            </div>

            <!-- Web Search Template -->
            <div class="settings-card gap-2.5">
              <p class="text-[13.5px] font-bold text-[var(--text)]">
                Web Search Template
              </p>
              <textarea
                v-model="settingsStore.systemSearchTemplate"
                @change="
                  settingsStore.updateSetting(
                    'systemSearchTemplate',
                    settingsStore.systemSearchTemplate,
                  )
                "
                class="custom-textarea h-24 font-mono text-[11px]"
              ></textarea>
            </div>

            <!-- Folder Context Template -->
            <div class="settings-card gap-2.5">
              <p class="text-[13.5px] font-bold text-[var(--text)]">
                Folder Context Template
              </p>
              <textarea
                v-model="settingsStore.systemFolderTemplate"
                @change="
                  settingsStore.updateSetting(
                    'systemFolderTemplate',
                    settingsStore.systemFolderTemplate,
                  )
                "
                class="custom-textarea h-24 font-mono text-[11px]"
              ></textarea>
            </div>
          </div>

          <!-- Account Section -->
          <div
            v-else-if="activeTab === 'account'"
            key="account"
            class="flex flex-col gap-[8px]"
          >
            <AccountSettings />
          </div>

          <!-- Maintenance Section -->
          <div
            v-else-if="activeTab === 'maintenance'"
            key="maintenance"
            class="flex flex-col gap-[8px]"
          >
            <SettingsRow icon="database">
              <template #label>Backup Database</template>
              <template #subtitle
                >Save a copy of your chat history and settings to a local
                file.</template
              >
              <template #control>
                <button
                  @click="backupDatabase"
                  class="px-4 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-[12px] text-[var(--text)] cursor-pointer hover:bg-[var(--bg-active)] transition-colors flex-shrink-0"
                >
                  Run Backup
                </button>
              </template>
            </SettingsRow>

            <SettingsRow icon="database">
              <template #label>Restore Database</template>
              <template #subtitle
                >Restore history and settings from a backup file. Your current
                data will be overwritten.</template
              >
              <template #control>
                <button
                  @click="confirmRestore"
                  class="px-4 py-1.5 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg text-[var(--danger)] text-[12px] font-bold cursor-pointer hover:bg-[var(--danger)] hover:text-white transition-all flex-shrink-0"
                >
                  Restore
                </button>
              </template>
            </SettingsRow>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="modal.show"
      :title="modal.title"
      :message="modal.message"
      :confirm-label="modal.confirmLabel"
      :kind="modal.kind"
      :hide-cancel="modal.hideCancel"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, h, type Component } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import ConfirmationModal from "../components/shared/ConfirmationModal.vue";
import ToggleSwitch from "../components/shared/ToggleSwitch.vue";
import SettingsSlider from "../components/settings/SettingsSlider.vue";
import SettingsRow from "../components/settings/SettingsRow.vue";
import AccountSettings from "../components/settings/AccountSettings.vue";
import HostSettings from "../components/settings/HostSettings.vue";
import AppTabs from "../components/shared/AppTabs.vue";
import { useSettingsStore } from "../stores/settings";
import { useConfirmationModal } from "../composables/useConfirmationModal";

const settingsStore = useSettingsStore();
const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

const themeOptions = [
  { id: "system" as const, label: "System", sub: "Follows OS" },
  { id: "light" as const, label: "Light", sub: "Always light" },
  { id: "dark" as const, label: "Dark", sub: "Always dark" },
];

function previewStyle(themeId: string) {
  const dark = themeId === "dark" || themeId === "system";
  return {
    background: dark ? "#1a1a1a" : "#f0f0f0",
    borderColor: dark ? "#242424" : "#e0e0e0",
  };
}
function previewSidebarStyle(themeId: string) {
  const dark = themeId === "dark" || themeId === "system";
  return {
    background: dark ? "#212121" : "#ffffff",
    borderColor: dark ? "#242424" : "#e0e0e0",
  };
}
function previewLineStyle(themeId: string, primary: boolean) {
  const dark = themeId === "dark" || themeId === "system";
  return {
    background: dark
      ? primary
        ? "#e8e8e8"
        : "#383838"
      : primary
        ? "#111111"
        : "#d0d0d0",
  };
}

const activeTab = ref("general");

interface Tab {
  id: string;
  name: string;
  icon?: Component;
}

// ---- Icons for Tabs ----
const IconGeneral = markRaw({
  setup() {
    return () =>
      h(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }),
          h("line", { x1: 3, y1: 9, x2: 21, y2: 9 }),
          h("line", { x1: 9, y1: 21, x2: 9, y2: 9 }),
        ],
      );
  },
});
const IconConnect = markRaw({
  setup() {
    return () =>
      h(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("path", { d: "M5 12.55a11 11 0 0 1 14.08 0" }),
          h("path", { d: "M1.42 9a16 16 0 0 1 21.16 0" }),
          h("circle", { cx: 12, cy: 20, r: 2 }),
        ],
      );
  },
});
const IconModels = markRaw({
  setup() {
    return () =>
      h(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("path", {
            d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
          }),
        ],
      );
  },
});
const IconPrompts = markRaw({
  setup() {
    return () =>
      h(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("path", {
            d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
          }),
        ],
      );
  },
});
const IconAccount = markRaw({
  setup() {
    return () =>
      h(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
          h("circle", { cx: 12, cy: 7, r: 4 }),
        ],
      );
  },
});
const IconBackup = markRaw({
  setup() {
    return () =>
      h(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }),
          h("path", { d: "M3 5v14a9 3 0 0 0 18 0V5" }),
          h("path", { d: "M3 12a9 3 0 0 0 21 0" }),
        ],
      );
  },
});

const tabs: Tab[] = [
  { id: "general", name: "General", icon: IconGeneral },
  { id: "connectivity", name: "Connection", icon: IconConnect },
  { id: "models", name: "Engine", icon: IconModels },
  { id: "prompts", name: "Prompts", icon: IconPrompts },
  { id: "account", name: "Account", icon: IconAccount },
  { id: "maintenance", name: "Maintenance", icon: IconBackup },
];

// ---- Model path ----
async function browseModelPath() {
  try {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      await settingsStore.updateSetting("modelPath", selected);
    }
  } catch (err) {
    console.error("Failed to pick directory:", err);
  }
}

// ---- Context length slider ----
const CTX_STEPS = [4096, 8192, 16384, 32768, 65536, 131072, 262144];

const ctxStepIndex = computed(() => {
  const idx = CTX_STEPS.indexOf(settingsStore.chatOptions.num_ctx);
  return idx >= 0 ? idx : 0;
});

function onCtxSlider(e: Event) {
  const idx = parseInt((e.target as HTMLInputElement).value, 10);
  const value = CTX_STEPS[idx];
  if (value !== undefined) {
    settingsStore.updateChatOptions({ num_ctx: value });
  }
}

// ---- Reset defaults ----
function confirmReset() {
  openModal({
    title: "Confirm Reset",
    message: "Reset all settings to defaults?",
    confirmLabel: "Reset",
    kind: "danger",
    onConfirm: async () => {
      await settingsStore.resetToDefaults();
    },
  });
}

async function backupDatabase() {
  try {
    await invoke("backup_database");
  } catch (err: unknown) {
    console.error("Backup failed:", err);
  }
}

function confirmRestore() {
  openModal({
    title: "Restore Database?",
    message:
      "All current chat history and settings will be replaced by the backup. A safety backup of your CURRENT data will be created automatically in the app directory.",
    confirmLabel: "Restore Now",
    kind: "danger",
    onConfirm: async () => {
      try {
        await invoke("restore_database");
        window.location.reload();
      } catch (err: unknown) {
        console.error("Restore failed:", err);
      }
    },
  });
}
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.settings-card {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
}

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

.custom-textarea {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12.5px;
  outline: none;
  resize: none;
  transition: all 0.2s;
}
.custom-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-muted);
}
.custom-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.theme-option {
  background: var(--bg-base);
  border-color: var(--border);
}
.theme-option--active {
  border-color: var(--accent);
  background: var(--accent-muted);
}
.theme-option--inactive:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
