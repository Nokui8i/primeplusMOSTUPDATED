"use client";

import { useEffect } from "react";

export function useKeyboardViewportFix() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    const winH = window.innerHeight;

    let rafId: number | null = null;
    let lastHeight = winH;

    const update = () => {
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const vh = vv?.height || winH;
        const roundedHeight = Math.round(vh);
        const offset = vv?.offsetTop || 0;
        const scale = vv?.scale || 1;
        
        // Only update if height actually changed to prevent unnecessary repaints
        if (roundedHeight !== lastHeight) {
          const heightDiff = roundedHeight - lastHeight;
          const keyboardOpen = roundedHeight < winH * 0.9;
          
          console.log('🔧 Keyboard Viewport Update:', {
            previousHeight: lastHeight,
            newHeight: roundedHeight,
            heightDifference: heightDiff,
            windowHeight: winH,
            visualViewportHeight: vv?.height,
            offsetTop: offset,
            scale: scale,
            keyboardOpen: keyboardOpen ? '✅ OPEN' : '❌ CLOSED',
            timestamp: new Date().toISOString()
          });
          
          root.style.setProperty("--vvh", `${roundedHeight}px`);
          lastHeight = roundedHeight;
        }
        
        rafId = null;
      });
    };

    // Initial sync update - start with window.innerHeight to fill screen
    // Then visualViewport will update it if different
    console.log('🔧 Keyboard Viewport Fix: Initializing', {
      windowHeight: winH,
      visualViewportHeight: vv?.height || 'N/A',
      visualViewportAvailable: !!vv,
      timestamp: new Date().toISOString()
    });
    
    root.style.setProperty("--vvh", `${winH}px`);
    lastHeight = winH;
    
    // Immediately check visualViewport and update if different
    if (vv && vv.height && vv.height !== winH) {
      const vhHeight = vv.height;
      console.log('🔧 Keyboard Viewport Fix: Initial update from visualViewport', {
        windowHeight: winH,
        visualViewportHeight: vhHeight,
        difference: vhHeight - winH
      });
      root.style.setProperty("--vvh", `${Math.round(vhHeight)}px`);
      lastHeight = Math.round(vhHeight);
    }

    // Use passive listeners for better performance
    vv?.addEventListener("resize", update, { passive: true });
    vv?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("orientationchange", update);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}


