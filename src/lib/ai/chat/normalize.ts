// src/lib/ai/chat/normalize.ts
import { COMMON_REPLACEMENTS, FACILITY_ALIASES } from "./typos";

export function normalizeUserText(input: string) {
  let text = (input ?? "").toLowerCase().trim();

  for (const [re, replacement] of COMMON_REPLACEMENTS) {
    text = text.replace(re, replacement);
  }

  // apply alias swaps (word boundary safe-ish)
  for (const [from, to] of Object.entries(FACILITY_ALIASES)) {
    const re = new RegExp(`\\b${escapeRegExp(from)}\\b`, "g");
    text = text.replace(re, to);
  }

  return text.trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
