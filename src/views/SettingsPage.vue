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
        <Transition name="fade-slide" mode="out-in">
          <GeneralTab v-if="activeTab === 'general'" key="general" />
          <ConnectivityTab
            v-else-if="activeTab === 'connectivity'"
            key="connectivity"
          />
          <ModelsTab v-else-if="activeTab === 'models'" key="models" />
          <PromptsTab v-else-if="activeTab === 'prompts'" key="prompts" />
          <AccountTab v-else-if="activeTab === 'account'" key="account" />
          <MaintenanceTab
            v-else-if="activeTab === 'maintenance'"
            key="maintenance"
          />
          <AdvancedTab v-else-if="activeTab === 'advanced'" key="advanced" />
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, type Component } from "vue";
import { useRoute } from "vue-router";
import AppTabs from "../components/shared/AppTabs.vue";
import GeneralTab from "./settings/GeneralTab.vue";
import ConnectivityTab from "./settings/ConnectivityTab.vue";
import ModelsTab from "./settings/ModelsTab.vue";
import PromptsTab from "./settings/PromptsTab.vue";
import AccountTab from "./settings/AccountTab.vue";
import MaintenanceTab from "./settings/MaintenanceTab.vue";
import AdvancedTab from "./settings/AdvancedTab.vue";
import {
  IconGeneral,
  IconConnect,
  IconModels,
  IconPrompts,
  IconAccount,
  IconBackup,
  IconAdvanced,
} from "../components/shared/icons";

const activeTab = ref("general");
const route = useRoute();

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

onMounted(() => {
  const tab = route?.query?.tab;
  if (typeof tab === "string" && tabs.some((t) => t.id === tab)) {
    activeTab.value = tab;
  }
});
</script>

<style scoped>
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
