<template>
  <div class="flex flex-col gap-5 px-1">
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
            settingsStore.updateSetting('systemFormattingEnabled', $event)
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
</template>

<script setup lang="ts">
import ToggleSwitch from "../../components/shared/ToggleSwitch.vue";
import { useSettingsStore } from "../../stores/settings";

const settingsStore = useSettingsStore();
</script>
