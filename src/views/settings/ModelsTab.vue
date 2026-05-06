<template>
  <div class="flex flex-col gap-[8px]">
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
</template>

<script setup lang="ts">
import { computed } from "vue";
import SettingsRow from "../../components/settings/SettingsRow.vue";
import ModelPathSettings from "../../components/settings/ModelPathSettings.vue";
import GpuLayersSettings from "../../components/settings/GpuLayersSettings.vue";
import PresetEditor from "../../components/settings/PresetEditor.vue";
import { useSettingsStore } from "../../stores/settings";

const settingsStore = useSettingsStore();

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
</script>
