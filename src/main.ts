import { createApp } from "vue";
import { createPinia } from "pinia";
import VueVirtualScroller from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import "./style.css";
import "katex/dist/katex.min.css";
import App from "./App.vue";
import router from "./router";
import { initMarkdown } from "./lib/markdown";

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  console.error("[Vue Error]", info, err);
};

globalThis.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
  event.preventDefault();
});

app.use(router);
app.use(createPinia());
app.use(VueVirtualScroller);

app.mount("#app");

// Preload Shiki after mount — doesn't block render, ready before first code block
setTimeout(() => initMarkdown().catch(() => {}), 0);
