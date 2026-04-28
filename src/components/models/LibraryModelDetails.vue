<template>
  <div class="flex-1 flex flex-col min-h-0 bg-[var(--bg-base)]">
    <!-- Model Header / Info -->
    <div
      class="flex flex-col md:flex-row items-start gap-6 pb-6 border-b border-[var(--border)] mb-0"
    >
      <div
        class="w-[52px] h-[52px] rounded-[14px] bg-[var(--bg-hover)] border border-[var(--border-strong)] flex items-center justify-center text-[22px] font-bold text-[var(--text)] flex-shrink-0"
      >
        {{ (model?.name ?? "?").charAt(0).toUpperCase() }}
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2.5 mb-2">
          <h1
            class="text-[22px] font-[800] text-[var(--text-heading)] leading-none"
          >
            {{ model?.name }}
          </h1>
          <div v-if="model?.tags" class="flex flex-wrap gap-1.5">
            <ModelTagBadge v-for="tag in model.tags" :key="tag" :tag="tag" />
          </div>
        </div>

        <p
          class="text-[13.5px] text-[var(--text-muted)] leading-relaxed mb-3 max-w-2xl"
        >
          {{ model?.description }}
        </p>

        <div
          class="flex flex-wrap items-center gap-4 text-[11.5px] text-[var(--text-dim)]"
        >
          <span class="flex items-center gap-1.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {{ model?.pull_count }} pulls
          </span>
          <span class="flex items-center gap-1.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Updated {{ model?.updated_at }}
          </span>
          <span class="flex items-center gap-1.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <path
                d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
              />
            </svg>
            Model License
          </span>
        </div>
      </div>

      <button
        @click="onPullLatest"
        class="bg-[var(--text)] text-[var(--bg-base)] px-5 py-2.5 rounded-[9px] text-[13px] font-[700] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex-shrink-0"
      >
        Pull model
      </button>
    </div>

    <!-- Tabs Header (Mirroring GlassTabs) -->
    <div
      class="flex items-center gap-2 border-b border-[var(--border)] mb-0 flex-shrink-0"
    >
      <button
        @click="activeSubTab = 'overview'"
        class="relative px-4 py-2.5 text-[13.5px] transition-all"
        :class="
          activeSubTab === 'overview'
            ? 'text-[var(--text)] font-semibold'
            : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
        "
      >
        Overview
        <div
          v-if="activeSubTab === 'overview'"
          class="absolute bottom-0 left-1.5 right-1.5 h-[2.5px] bg-[var(--accent)] rounded-t-full"
        />
      </button>
      <button
        @click="activeSubTab = 'tags'"
        class="relative px-4 py-2.5 text-[13.5px] transition-all"
        :class="
          activeSubTab === 'tags'
            ? 'text-[var(--text)] font-semibold'
            : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
        "
      >
        Tags ({{ tags.length }})
        <div
          v-if="activeSubTab === 'tags'"
          class="absolute bottom-0 left-1.5 right-1.5 h-[2.5px] bg-[var(--accent)] rounded-t-full"
        />
      </button>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-hidden relative">
      <Transition name="fade-subpage" mode="out-in">
        <!-- Overview Tab -->
        <div
          v-if="activeSubTab === 'overview'"
          key="overview"
          class="h-full flex gap-10 overflow-y-auto no-scrollbar pt-5 pb-12 pr-4"
        >
          <div class="flex-1 min-w-0">
            <!-- Quick Run Code Block -->
            <div
              class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] overflow-hidden mb-6"
            >
              <div class="flex border-b border-[var(--border)]">
                <button
                  v-for="t in codeTabs"
                  :key="t.id"
                  @click="activeCodeTab = t.id"
                  class="px-3.5 py-2 text-[12px] border-r border-[var(--border)] transition-colors"
                  :class="
                    activeCodeTab === t.id
                      ? 'bg-[var(--bg-hover)] text-[var(--text)] font-semibold'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                  "
                >
                  {{ t.label }}
                </button>
              </div>
              <div class="p-4 bg-[var(--bg-code)] overflow-x-auto">
                <pre
                  class="text-[13px] font-mono text-[var(--text-code)] leading-relaxed"
                  >{{ displayCode }}</pre
                >
              </div>
            </div>

            <!-- Readme Content -->
            <div
              v-if="isLoading"
              class="flex flex-col items-center justify-center py-20"
            >
              <div
                class="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"
              />
              <p class="text-[13px] text-[var(--text-dim)]">
                Loading documentation...
              </p>
            </div>
            <div v-else class="flex flex-col gap-8">
              <!-- Applications Section (Launch Topics) -->
              <LibraryApplications
                v-if="model?.launch_apps"
                :apps="model.launch_apps"
              />

              <div
                v-if="readmeHtml"
                v-html="readmeHtml"
                class="markdown-body"
                @click="onReadmeClick"
              />
              <div
                v-else
                class="py-20 text-center bg-[var(--bg-surface)]/30 border border-dashed border-[var(--border)] rounded-2xl"
              >
                <p class="text-[14px] text-[var(--text-muted)] italic">
                  No detailed documentation provided for this model.
                </p>
              </div>
            </div>
          </div>

          <!-- Sidebar (Overview) -->
          <div class="w-[240px] flex-shrink-0 hidden lg:flex flex-col gap-8">
            <div
              v-if="
                model?.tags &&
                model.tags.some((t) => !/^\d+(\.\d+)?[bBmM]$/.test(t))
              "
            >
              <div
                class="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest mb-4"
              >
                Capabilities
              </div>
              <div class="flex flex-wrap gap-1.5">
                <ModelTagBadge
                  v-for="tag in model.tags.filter(
                    (t) => !/^\d+(\.\d+)?[bBmM]$/.test(t),
                  )"
                  :key="tag"
                  :tag="tag"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Tags Tab (Grid/Table Layout) -->
        <div
          v-else
          key="tags"
          class="h-full overflow-y-auto pt-5 pb-12 no-scrollbar"
        >
          <p class="text-[13px] text-[var(--text-muted)] mb-5 leading-relaxed">
            Select a tag to pull a specific quantization of
            <strong class="text-[var(--text)]">{{ model?.name }}</strong> to
            your machine.
          </p>

          <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center py-24"
          >
            <div
              class="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"
            />
            <p class="text-[13px] text-[var(--text-dim)]">
              Fetching versions...
            </p>
          </div>

          <div
            v-else-if="tags.length === 0"
            class="py-20 text-center bg-[var(--bg-surface)]/30 border border-dashed border-[var(--border)] rounded-2xl"
          >
            <p class="text-[14px] text-[var(--text-muted)]">
              No tags found for this model.
            </p>
          </div>

          <div
            v-else
            class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] overflow-hidden shadow-sm"
          >
            <!-- Grid Header -->
            <div
              class="grid grid-cols-[1fr_100px_80px_80px_100px] gap-0 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-base)]/50"
            >
              <div
                v-for="h in ['Name', 'Size', 'Context', 'Input', '']"
                :key="h"
                class="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest last:text-right"
              >
                {{ h }}
              </div>
            </div>

            <!-- Grid Rows -->
            <div class="flex flex-col">
              <div
                v-for="tag in tags"
                :key="tag.name"
                class="relative grid grid-cols-[1fr_100px_80px_80px_100px] gap-0 px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-all group"
              >
                <!-- Name Column -->
                <div class="flex flex-col min-w-0 justify-center">
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="text-[13.5px] font-mono font-bold text-[var(--text)] truncate"
                      >{{ tagNameOnly(tag.name) }}</span
                    >
                    <span
                      v-if="tagNameOnly(tag.name) === 'latest'"
                      class="text-[9.5px] font-bold text-[var(--accent)] bg-[var(--accent-muted)] border border-[var(--accent-border)] rounded-md px-1.5 py-0.5 uppercase"
                      >latest</span
                    >
                  </div>
                  <div
                    class="flex items-center gap-1.5 text-[10.5px] text-[var(--text-dim)] opacity-70 group-hover:opacity-100 transition-opacity"
                  >
                    <span class="font-mono">{{
                      tag.hash.substring(0, 12)
                    }}</span>
                    <span class="opacity-50">•</span>
                    <span>{{ tag.updated_at }}</span>
                  </div>
                </div>

                <!-- Size -->
                <div
                  class="text-[13px] text-[var(--text-muted)] flex items-center font-medium"
                >
                  {{ tag.size || "--" }}
                </div>

                <!-- Context -->
                <div
                  class="text-[13px] text-[var(--text-muted)] flex items-center font-medium"
                >
                  {{ tag.context || "128K" }}
                </div>

                <!-- Input -->
                <div
                  class="text-[13px] text-[var(--text-muted)] flex items-center font-medium"
                >
                  {{ tag.input || "Text" }}
                </div>

                <!-- Action -->
                <div class="flex items-center justify-end">
                  <button
                    @click="onPull(tag.name)"
                    :disabled="isInstalled(tag.name) || isPulling(tag.name)"
                    class="px-4 py-1.5 rounded-lg text-[11.5px] font-bold transition-all min-w-[76px] border border-transparent shadow-sm"
                    :class="[
                      isInstalled(tag.name)
                        ? 'bg-transparent text-green-500 font-bold border-transparent'
                        : isPulling(tag.name)
                          ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                          : 'bg-[var(--text)] text-[var(--bg-base)] hover:scale-105 active:scale-95',
                    ]"
                  >
                    <span v-if="isInstalled(tag.name)">Ready</span>
                    <span v-else-if="isPulling(tag.name)"
                      >{{ getPullPercent(tag.name) }}%</span
                    >
                    <span v-else>Pull</span>
                  </button>
                </div>

                <!-- Row Progress Bar -->
                <div
                  v-if="isPulling(tag.name)"
                  class="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[var(--bg-hover)] overflow-hidden"
                >
                  <div
                    class="h-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] transition-all duration-300"
                    :style="{ width: getPullPercent(tag.name) + '%' }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { LibraryModel, LibraryTag } from "../../types/models";
import { useModelStore } from "../../stores/models";
import { openUrl } from "../../lib/urlOpener";
import { renderMarkdown } from "../../lib/markdown";
import ModelTagBadge from "../shared/ModelTagBadge.vue";
import LibraryApplications from "./LibraryApplications.vue";

const props = defineProps<{
  model: LibraryModel | null;
  tags: LibraryTag[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: "pull", tag: string): void;
}>();

const modelStore = useModelStore();
const activeSubTab = ref("overview");
const activeCodeTab = ref("cli");

const codeTabs = [
  { id: "cli", label: "CLI" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "rest", label: "REST" },
];

const displayCode = computed(() => {
  const name = props.model?.name ?? "model";
  if (activeCodeTab.value === "cli") return `ollama run ${name}`;
  if (activeCodeTab.value === "python")
    return `import ollama\nresponse = ollama.chat(model='${name}', messages=[{'role':'user','content':'Hello!'}])\nprint(response['message']['content'])`;
  if (activeCodeTab.value === "javascript")
    return `import ollama from 'ollama'\nconst response = await ollama.chat({ model: '${name}', messages: [{role:'user',content:'Hello!'}] })\nconsole.log(response.message.content)`;
  if (activeCodeTab.value === "rest")
    return `curl http://localhost:11434/api/chat -d '{\n  "model": "${name}",\n  "messages": [{"role":"user","content":"Hello!"}]\n}'`;
  return "";
});

const readmeHtml = computed(() => {
  if (!props.model?.readme) return "";
  return renderMarkdown(props.model.readme);
});

function tagNameOnly(fullName: string) {
  if (!fullName) return "";
  return fullName.includes(":") ? fullName.split(":")[1] : fullName;
}

function isInstalled(tagName: string) {
  return modelStore.isInstalled(tagName);
}

function isPulling(tagName: string) {
  return !!modelStore.pulling[tagName];
}

function getPullPercent(tagName: string) {
  return Math.round(modelStore.pulling[tagName]?.percent ?? 0);
}

function onPullLatest() {
  if (props.model) emit("pull", props.model.slug + ":latest");
}

function onPull(tagName: string) {
  emit("pull", tagName);
}

function onReadmeClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const link = target.closest("a");
  if (link && link.href && link.href.startsWith("http")) {
    e.preventDefault();
    openUrl(link.href);
  }
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

.fade-subpage-enter-active,
.fade-subpage-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-subpage-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-subpage-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

:deep(.markdown-body) {
  color: var(--text);
  line-height: 1.8;
  font-size: 14.5px;
  font-family: var(--font-base);
}
:deep(.markdown-body a) {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}
:deep(.markdown-body a:hover) {
  color: var(--accent-strong);
}
:deep(.markdown-body h1, .markdown-body h2, .markdown-body h3) {
  color: var(--text-heading);
  font-weight: 800;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
}
:deep(.markdown-body h1) {
  font-size: 1.8em;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.4em;
}
:deep(.markdown-body h2) {
  font-size: 1.5em;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0.3em;
}
:deep(.markdown-body h3) {
  font-size: 1.25em;
}

:deep(.markdown-body table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 2rem 0;
  font-size: 13.5px;
  background-color: var(--bg-surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
}
:deep(.markdown-body th) {
  background-color: var(--bg-base);
  text-align: left;
  padding: 0.85rem 1rem;
  border-bottom: 2px solid var(--border);
  color: var(--text-dim);
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}
:deep(.markdown-body td) {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}
:deep(.markdown-body tr:last-child td) {
  border-bottom: none;
}

:deep(.markdown-body code) {
  background-color: var(--bg-hover);
  padding: 0.2em 0.45em;
  border-radius: 6px;
  font-family: var(--mono);
  font-size: 0.85em;
  border: 1px solid var(--border-subtle);
  color: var(--text-heading);
}
:deep(.markdown-body pre) {
  background-color: var(--bg-code) !important;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  padding: 1.5rem;
  margin: 1.75rem 0;
  overflow-x: auto;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.1);
}
:deep(.markdown-body pre code) {
  background-color: transparent;
  padding: 0;
  border: none;
  font-size: 13.5px;
  line-height: 1.6;
}

:deep(.markdown-body img) {
  max-width: 100%;
  border-radius: 14px;
  margin: 2.5rem 0;
  border: 1px solid var(--border-strong);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

:deep(.markdown-body p) {
  margin-bottom: 1.4em;
  color: var(--text-muted);
}
:deep(.markdown-body strong) {
  color: var(--text);
  font-weight: 600;
}
:deep(.markdown-body ul, .markdown-body ol) {
  margin-bottom: 1.4em;
  padding-left: 1.5em;
}
:deep(.markdown-body li) {
  margin-bottom: 0.5em;
  color: var(--text-muted);
}

:deep(.markdown-body blockquote) {
  border-left: 4px solid var(--border-strong);
  padding-left: 1.5rem;
  color: var(--text-dim);
  font-style: italic;
  margin: 1.5rem 0;
}
</style>
