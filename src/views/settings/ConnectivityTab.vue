<template>
  <div class="flex flex-col gap-[8px]">
    <HostSettings />

    <SettingsRow icon="globe">
      <template #label>Ollama server URL</template>
      <template #control>
        <input
          v-model="settingsStore.serverUrl"
          @change="settingsStore.updateSetting('serverUrl', settingsStore.serverUrl)"
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
</template>

<script setup lang="ts">
import ToggleSwitch from "../../components/shared/ToggleSwitch.vue";
import SettingsRow from "../../components/settings/SettingsRow.vue";
import HostSettings from "../../components/settings/HostSettings.vue";
import { useSettingsStore } from "../../stores/settings";

const settingsStore = useSettingsStore();
</script>
