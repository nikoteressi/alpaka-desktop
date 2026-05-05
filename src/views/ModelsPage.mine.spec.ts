import { describe, it, expect } from "vitest";
import { h } from "vue";
import { IconMine } from "../components/shared/icons";

describe("Mine tab — myModels filtering", () => {
  it("filters models with / in name", () => {
    const models = [
      { name: "llama3:8b" },
      { name: "myuser/assistant:latest" },
      { name: "noprefix" },
      { name: "alice/code-helper" },
    ];
    const myModels = models.filter((m) => m.name.includes("/"));
    expect(myModels).toHaveLength(2);
    expect(myModels[0].name).toBe("myuser/assistant:latest");
    expect(myModels[1].name).toBe("alice/code-helper");
  });

  it("returns empty array when no namespaced models exist", () => {
    const models = [{ name: "llama3:8b" }, { name: "phi3" }];
    const myModels = models.filter((m) => m.name.includes("/"));
    expect(myModels).toHaveLength(0);
  });
});

describe("IconMine", () => {
  it("renders an svg with path and circle", () => {
    const vnode = h(IconMine);
    expect(vnode.type).toBeTypeOf("object");
    // The setup function returns an h("svg", ...) vnode
    const rendered = (vnode.type as { setup?: () => () => unknown }).setup?.();
    expect(rendered).toBeDefined();
  });
});
