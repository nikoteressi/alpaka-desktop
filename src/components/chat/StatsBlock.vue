<template>
  <div class="stats-block">
    <button @click="toggle" class="stats-toggle-btn">
      <div class="stats-summary">
        <!-- Speed -->
        <CustomTooltip text="Generation speed">
          <span class="stat-badge">
            <span class="stat-dot pulse"></span>
            {{ (tokensPerSec || 0).toFixed(1) }}
            <span class="stat-unit">tokens/s</span>
          </span>
        </CustomTooltip>

        <!-- Output -->
        <CustomTooltip v-if="outputTokens" text="Tokens generated in response">
          <span class="stat-badge">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {{ outputTokens }} <span class="stat-unit">output</span>
          </span>
        </CustomTooltip>

        <!-- Input -->
        <CustomTooltip
          v-if="inputTokens"
          text="Tokens in the user prompt and context"
        >
          <span class="stat-badge">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {{ inputTokens }} <span class="stat-unit">input</span>
          </span>
        </CustomTooltip>

        <!-- Time -->
        <CustomTooltip
          v-if="generationTimeMs"
          text="Total generation time taken"
        >
          <span class="stat-badge">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {{ (generationTimeMs / 1000).toFixed(2) }}s
          </span>
        </CustomTooltip>

        <!-- Seed (only when a fixed seed was used) -->
        <CustomTooltip
          v-if="seed !== undefined"
          text="Fixed seed — generation is reproducible"
        >
          <span class="stat-badge stat-badge--seed" data-testid="seed-badge">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {{ seed }}
          </span>
        </CustomTooltip>

        <span class="more-label">
          {{ isOpen ? "Hide" : "More" }}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :style="{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
    </button>

    <div
      class="stats-accordion"
      :class="{ 'stats-accordion--closed': !isOpen }"
    >
      <div class="stats-accordion__inner">
        <div class="full-stats-container">
          <table class="full-stats-table">
            <thead class="sr-only">
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Duration</td>
                <td>{{ (metrics.total_duration_ms || 0) / 1000 }}s</td>
              </tr>
              <tr>
                <td>Load Duration</td>
                <td>{{ metrics.load_duration_ms || 0 }}ms</td>
              </tr>
              <tr>
                <td>Prompt Eval Count</td>
                <td>{{ inputTokens || 0 }} tokens</td>
              </tr>
              <tr>
                <td>Prompt Eval Duration</td>
                <td>{{ metrics.prompt_eval_duration_ms || 0 }}ms</td>
              </tr>
              <tr>
                <td>Prompt Eval Rate</td>
                <td>
                  {{
                    inputTokens && metrics.prompt_eval_duration_ms
                      ? (
                          inputTokens /
                          (metrics.prompt_eval_duration_ms / 1000)
                        ).toFixed(1)
                      : 0
                  }}
                  tokens/s
                </td>
              </tr>
              <tr>
                <td>Eval Count</td>
                <td>{{ outputTokens || 0 }} tokens</td>
              </tr>
              <tr>
                <td>Eval Duration</td>
                <td>{{ metrics.eval_duration_ms || 0 }}ms</td>
              </tr>
              <tr>
                <td>Eval Rate (Generation)</td>
                <td>{{ (tokensPerSec || 0).toFixed(1) }} tokens/s</td>
              </tr>
              <tr v-if="seed !== undefined" data-testid="seed-row">
                <td>Seed</td>
                <td>{{ seed }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CustomTooltip from "../shared/CustomTooltip.vue";
import { useCollapsibleState } from "../../composables/useCollapsibleState";

const props = defineProps<{
  metrics: {
    total_duration_ms?: number;
    load_duration_ms?: number;
    prompt_eval_duration_ms?: number;
    eval_duration_ms?: number;
  };
  tokensPerSec: number;
  outputTokens: number;
  inputTokens: number;
  generationTimeMs: number;
  messageKey?: string;
  seed?: number;
}>();

// suffix: 'stats' isolates this cache key from ThinkBlock (bare key) and SearchBlock ('search')
const { isOpen, toggle: _toggle } = useCollapsibleState({
  messageKey: props.messageKey,
  suffix: "stats",
  initialOpen: false,
});

function toggle(event: MouseEvent) {
  event.stopPropagation();
  _toggle();
}
</script>

<style scoped>
.stats-block {
  margin-top: 16px;
}

.stats-toggle-btn {
  background: none;
  border: none;
  width: 100%;
  padding: 0;
  cursor: pointer;
  text-align: left;
  display: block;
}

.stats-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--bg-active);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s ease;
  user-select: none;
}

.stat-badge:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--text);
}

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}

.stat-dot.pulse {
  box-shadow: 0 0 8px var(--success);
}

.stat-unit {
  font-size: 9px;
  color: var(--text-dim);
  margin-left: -2px;
}

.more-label {
  font-size: 10px;
  color: var(--text-dim);
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
  font-weight: 500;
}

.stats-toggle-btn:hover .more-label {
  background: var(--bg-active);
  color: var(--text-muted);
}

.stats-accordion {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stats-accordion--closed {
  grid-template-rows: 0fr;
}

.stats-accordion__inner {
  overflow: hidden;
}

.full-stats-container {
  margin-top: 8px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px;
}

.full-stats-table {
  width: 100%;
  font-size: 11px;
  color: var(--text-muted);
  border-collapse: collapse;
}

.full-stats-table td {
  padding: 4px 0;
}

.full-stats-table td:first-child {
  font-family: var(--sans);
  color: var(--text-dim);
}

.full-stats-table td:last-child {
  text-align: right;
  font-family: var(--mono);
  color: var(--text-muted);
}

.full-stats-table tr:not(:last-child) {
  border-bottom: 1px solid var(--border-subtle);
}

.stat-badge--seed {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-active));
  font-weight: 600;
}
</style>
