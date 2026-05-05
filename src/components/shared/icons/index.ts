import { markRaw, h } from "vue";

const svgBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

export const IconNewChat = markRaw({
  setup() {
    return () =>
      h("svg", { ...svgBase, "stroke-width": 2.5 }, [
        h("path", { d: "M12 5v14M5 12h14" }),
      ]);
  },
});

export const IconLaunch = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", {
          d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
        }),
        h("path", {
          d: "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
        }),
      ]);
  },
});

export const IconModels = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", {
          d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
        }),
      ]);
  },
});

export const IconSettings = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("circle", { cx: 12, cy: 12, r: 3 }),
        h("path", {
          d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
        }),
      ]);
  },
});

export const IconGeneral = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }),
        h("line", { x1: 3, y1: 9, x2: 21, y2: 9 }),
        h("line", { x1: 9, y1: 21, x2: 9, y2: 9 }),
      ]);
  },
});

export const IconConnect = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", { d: "M5 12.55a11 11 0 0 1 14.08 0" }),
        h("path", { d: "M1.42 9a16 16 0 0 1 21.16 0" }),
        h("circle", { cx: 12, cy: 20, r: 2 }),
      ]);
  },
});

export const IconPrompts = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", {
          d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
        }),
      ]);
  },
});

export const IconAccount = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
        h("circle", { cx: 12, cy: 7, r: 4 }),
      ]);
  },
});

export const IconBackup = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }),
        h("path", { d: "M3 5v14a9 3 0 0 0 18 0V5" }),
        h("path", { d: "M3 12a9 3 0 0 0 18 0" }),
      ]);
  },
});

export const IconAdvanced = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("circle", { cx: 12, cy: 12, r: 3 }),
        h("path", {
          d: "M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14",
        }),
      ]);
  },
});

export const IconLibrary = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", { d: "m16 6 4 14" }),
        h("path", { d: "M12 6v14" }),
        h("path", { d: "M8 8v12" }),
        h("path", { d: "M4 4v16" }),
      ]);
  },
});

export const IconLocal = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("rect", { x: 2, y: 2, width: 20, height: 8, rx: 2 }),
        h("rect", { x: 2, y: 14, width: 20, height: 8, rx: 2 }),
        h("line", { x1: 6, y1: 6, x2: 6, y2: 6 }),
        h("line", { x1: 6, y1: 18, x2: 6, y2: 18 }),
      ]);
  },
});

export const IconCloud = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", { d: "M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11 6.5" }),
      ]);
  },
});

export const IconEngine = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", { d: "M12 2v4" }),
        h("path", { d: "M12 18v4" }),
        h("path", { d: "M4.93 4.93l2.83 2.83" }),
        h("path", { d: "M16.24 16.24l2.83 2.83" }),
        h("path", { d: "M2 12h4" }),
        h("path", { d: "M18 12h4" }),
        h("path", { d: "M4.93 19.07l2.83-2.83" }),
        h("path", { d: "M16.24 7.76l2.83-2.83" }),
      ]);
  },
});

export const IconMine = markRaw({
  setup() {
    return () =>
      h("svg", svgBase, [
        h("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
        h("circle", { cx: 12, cy: 7, r: 4 }),
      ]);
  },
});
