"use client";

import { useEffect } from "react";
import { usePlaybook } from "./PlaybookProvider";

/**
 * When another view sends the reader here (search, a "see full play" link, a scouting report),
 * reset this view's filters, scroll the target into view and highlight it briefly.
 */
export function useFocusFlash(kind: "play" | "sys" | "term", elementId: (id: string) => string, resetFilters: () => void) {
  const { focus, clearFocus } = usePlaybook();
  useEffect(() => {
    if (!focus || focus.kind !== kind) return;
    resetFilters();
    const id = elementId(focus.id);
    clearFocus();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(id); if (!el) return;
      el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2200);
    }));
  }, [focus, kind, elementId, resetFilters, clearFocus]);
}
