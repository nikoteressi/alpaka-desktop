<template>
  <div
    v-if="hostStore.isHostManagerOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  >
    <div
      class="bg-white dark:bg-[#1A1A1A] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Hosts Manager
        </h2>
        <button
          @click="hostStore.isHostManagerOpen = false"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="p-6 flex-1 overflow-y-auto">
        <div class="space-y-4">
          <div
            v-for="host in hostStore.hosts"
            :key="host.id"
            class="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-[#0F0F0F] flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <span class="relative flex h-3 w-3">
                <span
                  v-if="host.last_ping_status === 'online'"
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
                ></span>
                <span
                  class="relative inline-flex rounded-full h-3 w-3"
                  :class="statusColor(host.last_ping_status)"
                ></span>
              </span>
              <div>
                <p
                  class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2"
                >
                  {{ host.name }}
                  <span
                    v-if="host.is_active"
                    class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    >Active</span
                  >
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {{ host.url }}
                </p>
              </div>
            </div>

            <div class="flex space-x-2">
              <button
                v-if="!host.is_active"
                @click="switchHost(host.id)"
                class="px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-[#FF6B35] hover:bg-[#E85D2C] transition-colors"
              >
                Connect
              </button>
              <button
                @click="deleteHost(host.id, host.is_active)"
                class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete Host"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6 border-t border-gray-100 dark:border-neutral-800 pt-6">
          <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
            Add New Host
          </h3>
          <form @submit.prevent="addNewHost" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1"
                >Display Name</label
              >
              <input
                v-model="newHost.name"
                type="text"
                required
                class="w-full px-3 py-2 bg-white dark:bg-[#0F0F0F] border border-gray-200 dark:border-neutral-800 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none text-gray-900 dark:text-gray-100"
                placeholder="e.g. Home Server"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1"
                >Endpoint URL</label
              >
              <input
                v-model="newHost.url"
                type="url"
                required
                class="w-full px-3 py-2 bg-white dark:bg-[#0F0F0F] border border-gray-200 dark:border-neutral-800 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none text-gray-900 dark:text-gray-100 focus:invalid:ring-red-500"
                placeholder="http://192.168.1.100:11434"
              />
            </div>
            <button
              type="submit"
              class="w-full py-2.5 font-medium rounded-lg text-white bg-[#FF6B35] hover:bg-[#E85D2C] transition-colors flex justify-center items-center gap-2"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Host
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- Custom Confirmation Modal -->
    <ConfirmationModal
      :show="modal.show"
      :title="modal.title"
      :message="modal.message"
      :confirm-label="modal.confirmLabel"
      :kind="modal.kind"
      :hide-cancel="modal.hideCancel"
      @confirm="onModalConfirm"
      @cancel="modal.show = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import ConfirmationModal from "../shared/ConfirmationModal.vue";
import { useHostStore } from "../../stores/hosts";

const hostStore = useHostStore();

const newHost = ref({
  name: "",
  url: "",
});

function statusColor(status: string) {
  if (status === "online") return "bg-green-500";
  if (status === "offline") return "bg-red-500";
  return "bg-gray-400";
}

async function addNewHost() {
  if (!newHost.value.name || !newHost.value.url) return;
  await hostStore.addHost(newHost.value.name, newHost.value.url);
  newHost.value.name = "";
  newHost.value.url = "";
}

async function switchHost(id: string) {
  await hostStore.setActiveHost(id);
}

// Modal state
const modal = reactive({
  show: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  kind: "primary",
  hideCancel: false,
  onConfirm: () => {},
});

function onModalConfirm() {
  modal.onConfirm();
  modal.show = false;
}

async function deleteHost(id: string, isActive: boolean) {
  if (isActive) {
    modal.title = "Action Prohibited";
    modal.message =
      "You cannot delete the active host. Please switch to another host first.";
    modal.confirmLabel = "OK";
    modal.kind = "primary";
    modal.hideCancel = true;
    modal.onConfirm = () => {};
    modal.show = true;
    return;
  }

  modal.title = "Confirm Delete";
  modal.message = "Are you sure you want to delete this host?";
  modal.confirmLabel = "Delete";
  modal.kind = "danger";
  modal.hideCancel = false;
  modal.onConfirm = () => hostStore.deleteHost(id);
  modal.show = true;
}
</script>
