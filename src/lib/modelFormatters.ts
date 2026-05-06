import type { ModelCapabilities } from "../types/models";

export function formatSize(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + " MB";
  return bytes + " B";
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function getActiveCapTags(
  caps: ModelCapabilities | undefined,
): string[] {
  if (!caps) return [];
  const tags: string[] = [];
  if (caps.vision) tags.push("vision");
  if (caps.tools) tags.push("tools");
  if (caps.thinking) tags.push("thinking");
  return tags;
}
