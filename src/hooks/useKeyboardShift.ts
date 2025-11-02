// src/hooks/useKeyboardShift.tsx
import { useEffect, RefObject } from "react";

/**
 * useKeyboardShift - OnlyFans-style fallback
 * 
 * מה זה עושה: מאזין ל־focusin/focusout על מסמך. כשמזהה ש־input קיבל פוקוס — 
 * מפעיל callback עם כמות תזוזה (px).
 * 
 * למה צריך: אם הדפדפן לא שולח resize אמין על פתיחה של מקלדת, 
 * נגלה focus ונבצע transform של ה־root container. 
 * זה עובד טוב מאוד ב־iOS Chrome/Safari.
 */
export function useKeyboardShift(
  rootSelectorOrRef: string | HTMLElement | RefObject<HTMLElement> | null,
  options?: { maxShiftPx?: number; debug?: boolean }
) {
  const maxShiftPx = options?.maxShiftPx ?? 350;
  const debug = options?.debug ?? false;

  useEffect(() => {
    const getRoot = (): HTMLElement | null => {
      if (!rootSelectorOrRef) return null;
      if (typeof rootSelectorOrRef === "string") {
        return document.querySelector(rootSelectorOrRef);
      }
      if (rootSelectorOrRef instanceof HTMLElement) return rootSelectorOrRef;
      // Handle RefObject
      if (rootSelectorOrRef && 'current' in rootSelectorOrRef) {
        return rootSelectorOrRef.current;
      }
      return null;
    };

    const rootEl = getRoot();
    if (!rootEl) return;

    let activeInput: HTMLElement | null = null;

    const computeShift = (input: HTMLElement) => {
      // simple heuristic: we can measure distance from input bottom to window.innerHeight 
      // and shift so input not hidden
      const rect = input.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const needed = Math.max(0, rect.bottom - (viewportH - 200)); // try to keep 200px above bottom
      const shift = Math.min(maxShiftPx, Math.ceil(needed));
      return shift;
    };

    const doShift = (shiftPx: number) => {
      rootEl.style.transition = "transform 250ms cubic-bezier(0.25, 1, 0.5, 1)";
      rootEl.style.transform = `translateY(-${shiftPx}px)`;
      if (debug) {
        console.log("[useKeyboardShift] shifting", shiftPx, "px");
      }
    };

    const clearShift = () => {
      rootEl.style.transition = "transform 250ms cubic-bezier(0.25, 1, 0.5, 1)";
      rootEl.style.transform = "";
      if (debug) {
        console.log("[useKeyboardShift] clearing shift");
      }
    };

    const onFocusIn = (ev: FocusEvent) => {
      const el = ev.target as HTMLElement;
      if (!el) return;
      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el.isContentEditable) {
        activeInput = el;
        // small timeout to allow native keyboard to show, then use RAF for smooth animation
        setTimeout(() => {
          requestAnimationFrame(() => {
            const shift = computeShift(el);
            if (debug) console.log("[useKeyboardShift] focusin shift", shift, el);
            doShift(shift);
          });
        }, 120);
      }
    };

    const onFocusOut = (ev: FocusEvent) => {
      const el = ev.target as HTMLElement;
      if (!el) return;
      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el.isContentEditable) {
        activeInput = null;
        // give time for keyboard to close, then use RAF for smooth animation
        setTimeout(() => {
          requestAnimationFrame(() => {
            clearShift();
          });
        }, 120);
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      clearShift();
    };
    // Note: We include rootSelectorOrRef in deps even if it's a ref, because React will re-run
    // when the ref object itself changes. For ref.current updates, we check inside the effect.
  }, [rootSelectorOrRef, maxShiftPx, debug]);
}

