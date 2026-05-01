<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="show"
        class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <Transition name="modal-scale">
          <div
            v-if="show"
            class="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            :style="{ maxWidth: maxWidth }"
          >
            <!-- Header -->
            <div
              v-if="title || showClose"
              class="px-5 py-4 border-b border-[var(--border-strong)] flex items-center justify-between bg-[var(--bg-surface)]"
            >
              <h3 class="text-lg font-semibold text-white truncate">
                {{ title }}
              </h3>
              <button
                v-if="showClose"
                @click="emit('close')"
                class="text-[var(--text-muted)] hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
              >
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto">
              <slot />
            </div>

            <!-- Footer -->
            <div
              v-if="$slots.footer"
              class="px-5 py-4 bg-[var(--bg-base)] border-t border-[var(--border-strong)] flex justify-end gap-2"
            >
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

const props = defineProps({
  show: Boolean,
  title: String,
  showClose: { type: Boolean, default: true },
  maxWidth: { type: String, default: "440px" },
});

const emit = defineEmits(["close"]);

function handleEsc(e: KeyboardEvent) {
  if (e.key === "Escape" && props.show) {
    emit("close");
  }
}

onMounted(() => globalThis.addEventListener("keydown", handleEsc));
onUnmounted(() => globalThis.removeEventListener("keydown", handleEsc));
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition:
    transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    opacity 0.2s ease;
}
.modal-scale-enter-from,
.modal-scale-leave-to {
  transform: scale(0.92);
  opacity: 0;
}
</style>
