<template>
  <div class="h-full overflow-y-auto px-6 py-5 no-scrollbar">
    <div class="max-w-[740px] mx-auto">
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

            <ProxySettings />
          </div>

          <!-- Models Section -->
          <div
            v-else-if="activeTab === 'models'"
            key="models"
            class="flex flex-col gap-[8px]"
          >
            <ModelPathSettings />

            <GpuLayersSettings />

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

            <!-- Presets -->
            <PresetEditor />
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

          <!-- Advanced Section -->
          <div
            v-else-if="activeTab === 'advanced'"
            key="advanced"
            class="flex flex-col gap-[8px]"
          >
            <div class="settings-card">
              <div>
                <p class="text-[13.5px] font-bold text-[var(--text)]">
                  Stop Sequences
                </p>
                <p class="text-[12px] text-[var(--text-dim)] mt-0.5">
                  Custom tokens that end generation early. Up to 4 sequences.
                </p>
              </div>
              <div class="mt-3">
                <StopSequencesInput
                  :model-value="settingsStore.chatOptions.stop ?? []"
                  @update:model-value="
                    settingsStore.updateChatOptions({
                      stop: $event.length ? $event : undefined,
                    })
                  "
                />
              </div>
            </div>

            <!-- Seed -->
            <div class="settings-card gap-3">
              <div>
                <p class="text-[13.5px] font-bold text-[var(--text)]">Seed</p>
                <p class="text-[12px] text-[var(--text-dim)] mt-0.5">
                  Fixed integer for reproducible generation. Leave empty for
                  random output.
                </p>
              </div>
              <div class="flex items-center gap-3">
                <input
                  type="number"
                  :value="settingsStore.chatOptions.seed ?? ''"
                  @change="
                    (() => {
                      const v = ($event.target as HTMLInputElement).value;
                      const n = parseInt(v, 10);
                      settingsStore.updateChatOptions({
                        seed: v === '' || Number.isNaN(n) ? undefined : n,
                      });
                    })()
                  "
                  placeholder="empty = random"
                  class="w-40 bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 text-[12px] outline-none transition-colors"
                  :class="
                    settingsStore.chatOptions.seed !== undefined
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : ''
                  "
                />
                <button
                  v-if="settingsStore.chatOptions.seed !== undefined"
                  @click="settingsStore.updateChatOptions({ seed: undefined })"
                  class="text-[11px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                >
                  Reset to random
                </button>
              </div>
            </div>
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
import { ref, computed, onMounted, type Component } from "vue";
import { useRoute } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import ConfirmationModal from "../components/shared/ConfirmationModal.vue";
import ToggleSwitch from "../components/shared/ToggleSwitch.vue";
import SettingsRow from "../components/settings/SettingsRow.vue";
import AccountSettings from "../components/settings/AccountSettings.vue";
import HostSettings from "../components/settings/HostSettings.vue";
import ProxySettings from "../components/settings/ProxySettings.vue";
import ModelPathSettings from "../components/settings/ModelPathSettings.vue";
import GpuLayersSettings from "../components/settings/GpuLayersSettings.vue";
import PresetEditor from "../components/settings/PresetEditor.vue";
import AppTabs from "../components/shared/AppTabs.vue";
import StopSequencesInput from "../components/settings/StopSequencesInput.vue";
import { useSettingsStore } from "../stores/settings";
import { useConfirmationModal } from "../composables/useConfirmationModal";
import {
  IconGeneral,
  IconConnect,
  IconModels,
  IconPrompts,
  IconAccount,
  IconBackup,
  IconAdvanced,
} from "../components/shared/icons";

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
  let background: string;
  if (dark) {
    background = primary ? "#e8e8e8" : "#383838";
  } else {
    background = primary ? "#111111" : "#d0d0d0";
  }
  return { background };
}

const activeTab = ref("general");
const route = useRoute();
onMounted(() => {
  const tab = route?.query?.tab;
  if (typeof tab === "string" && tabs.some((t) => t.id === tab)) {
    activeTab.value = tab;
  }
});

interface Tab {
  id: string;
  name: string;
  icon?: Component;
}

const tabs: Tab[] = [
  { id: "general", name: "General", icon: IconGeneral },
  { id: "connectivity", name: "Connection", icon: IconConnect },
  { id: "models", name: "Engine", icon: IconModels },
  { id: "prompts", name: "Prompts", icon: IconPrompts },
  { id: "account", name: "Account", icon: IconAccount },
  { id: "maintenance", name: "Maintenance", icon: IconBackup },
  { id: "advanced", name: "Advanced", icon: IconAdvanced },
];

// ---- Context length slider ----
const CTX_STEPS = [4096, 8192, 16384, 32768, 65536, 131072, 262144];

const ctxStepIndex = computed(() => {
  const idx = CTX_STEPS.indexOf(settingsStore.chatOptions.num_ctx);
  return Math.max(idx, 0);
});

function onCtxSlider(e: Event) {
  const idx = Number.parseInt((e.target as HTMLInputElement).value, 10);
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
      const hadCustomPath = !!settingsStore.modelPath;
      await settingsStore.resetToDefaults();
      if (hadCustomPath) {
        await applyModelPath("");
      }
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
        globalThis.location.reload();
      } catch (err: unknown) {
        console.error("Restore failed:", err);
      }
    },
  });
}
</script>

<style scoped>
.settings-card {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
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
