// src/lib/ai/chat/normalize.ts
import { normalizeForBookingChat } from "./typos";

/**
 * Single entry point used by route.ts
 * Normalizes user input and applies booking related typo rules.
 */
export function normalizeUserText(input?: string | null) {
  return normalizeForBookingChat(input ?? "");
}
