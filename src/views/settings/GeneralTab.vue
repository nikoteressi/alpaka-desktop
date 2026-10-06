<template>
  <div class="flex flex-col gap-[8px]">
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
            settingsStore.updateSetting('showPerformanceMetrics', $event)
          "
        />
      </template>
    </SettingsRow>

    <SettingsRow icon="bell">
      <template #label>Desktop Notifications</template>
      <template #subtitle
        >Get notified when models finish downloading or errors occur.</template
      >
      <template #control>
        <ToggleSwitch
          :value="settingsStore.notificationsEnabled"
          @change="settingsStore.updateSetting('notificationsEnabled', $event)"
        />
      </template>
    </SettingsRow>

    <SettingsRow icon="sliders">
      <template #label>Compaction model</template>
      <template #subtitle
        >Model used to summarize conversations when compacting. Defaults to the
        active conversation's model.</template
      >
      <template #control>
        <div class="relative" ref="compactionModelDropdownRef">
          <button
            @click="compactionModelOpen = !compactionModelOpen"
            class="flex items-center justify-between gap-1.5 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] rounded-lg px-2 py-1.5 text-[11px] cursor-pointer hover:border-[var(--accent)] transition-colors w-44"
            :class="compactionModelOpen ? 'border-[var(--accent)]' : ''"
          >
            <span class="truncate">{{
              settingsStore.compactionModel || "Same as conversation"
            }}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              class="transition-transform flex-shrink-0"
              :class="compactionModelOpen ? 'rotate-180' : ''"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div
            v-if="compactionModelOpen"
            class="absolute top-full right-0 mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg shadow-xl z-50 max-h-[240px] overflow-y-auto"
          >
            <button
              @click="selectCompactionModel('')"
              class="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              :class="
                !settingsStore.compactionModel
                  ? 'text-[var(--accent)] font-semibold'
                  : 'text-[var(--text)]'
              "
            >
              Same as conversation model
            </button>
            <button
              v-for="m in modelStore.models"
              :key="m.name"
              @click="selectCompactionModel(m.name)"
              class="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer truncate"
              :class="
                settingsStore.compactionModel === m.name
                  ? 'text-[var(--accent)] font-semibold'
                  : 'text-[var(--text)]'
              "
            >
              {{ m.name }}
            </button>
          </div>
        </div>
      </template>
    </SettingsRow>

    <!-- Appearance / Theme Picker -->
    <div class="settings-card">
      <div>
        <p class="text-[13.5px] font-bold text-[var(--text)]">Appearance</p>
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
              <div
                class="w-1/4 h-full border-r border-[var(--border-subtle)]"
                :style="previewSidebarStyle(opt.id)"
              />
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

    <ConfirmationModal
      :show="modal.show"
      :title="modal.title"
      :message="modal.message"
      :confirm-label="modal.confirmLabel"
      :kind="modal.kind"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import ToggleSwitch from "../../components/shared/ToggleSwitch.vue";
import SettingsRow from "../../components/settings/SettingsRow.vue";
import ConfirmationModal from "../../components/shared/ConfirmationModal.vue";
import { useSettingsStore } from "../../stores/settings";
import { useModelStore } from "../../stores/models";
import { useConfirmationModal } from "../../composables/useConfirmationModal";

const settingsStore = useSettingsStore();
const modelStore = useModelStore();
const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

const compactionModelOpen = ref(false);
const compactionModelDropdownRef = ref<HTMLElement | null>(null);

function selectCompactionModel(name: string) {
  settingsStore.updateSetting("compactionModel", name);
  compactionModelOpen.value = false;
}

function handleClickOutside(e: MouseEvent) {
  if (
    compactionModelDropdownRef.value &&
    !compactionModelDropdownRef.value.contains(e.target as Node)
  ) {
    compactionModelOpen.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", handleClickOutside));
onUnmounted(() =>
  document.removeEventListener("mousedown", handleClickOutside),
);

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
</script>

<style scoped>
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
</style>
