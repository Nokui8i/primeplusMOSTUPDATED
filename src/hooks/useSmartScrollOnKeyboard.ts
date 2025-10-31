import { useEffect, RefObject } from "react";

/**
 * Smart scroll management for Messages Container when keyboard opens/closes
 * 
 * This hook monitors visualViewport changes and intelligently manages scroll position:
 * - If user is at bottom: keeps them at bottom when keyboard opens/closes
 * - If user is NOT at bottom: preserves relative scroll position (WhatsApp-style)
 * 
 * @param messagesRef - Ref to the Messages Container (flex-1 overflow-y-auto)
 * @param isMobile - Whether this is a mobile device (default: true)
 */
export function useSmartScrollOnKeyboard(
  messagesRef: RefObject<HTMLDivElement>,
  isMobile: boolean = true
) {
  useEffect(() => {
    if (!messagesRef.current || typeof window === "undefined") return;
    if (!isMobile) return;
    
    const vv = window.visualViewport as VisualViewport;
    if (!vv) return;

    const container = messagesRef.current;
    let prevHeight = vv.height;

    /**
     * Check if user is currently at the bottom of the messages container
     */
    const isAtBottom = (): boolean => {
      if (!container) return false;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      return distanceFromBottom <= 2; // 2px tolerance
    };

    /**
     * Scroll container to bottom
     */
    const scrollToBottom = () => {
      if (!container) return;
      const targetScrollTop = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.max(0, targetScrollTop);
    };

    /**
     * Handle viewport changes (keyboard open/close)
     * This is the core logic that prevents jumps
     */
    const updateScroll = () => {
      if (!container) return;
      
      const newHeight = vv.height;
      const delta = prevHeight - newHeight;
      prevHeight = newHeight;

      // Check if user is at bottom BEFORE handling the change
      const atBottom = isAtBottom();

      if (delta > 50) {
        // Keyboard opened (viewport shrunk significantly)
        if (atBottom) {
          // User was at bottom - keep them at bottom after container resizes
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollToBottom();
              // Double-check after keyboard animation fully settles
              setTimeout(() => {
                if (container && isAtBottom()) {
                  scrollToBottom();
                }
              }, 200);
            });
          });
        }
        // If NOT at bottom: Do NOTHING
        // Browser automatically preserves visible content when container shrinks
        // Content appears to move WITH the container (WhatsApp-style)
      } else if (delta < -50) {
        // Keyboard closed (viewport grew significantly)
        if (atBottom) {
          // User was at bottom - keep them at bottom after container grows
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollToBottom();
            });
          });
        }
        // If NOT at bottom: Do NOTHING
        // Browser automatically preserves visible content when container grows
      }
    };

    // Listen to viewport changes
    vv.addEventListener("resize", updateScroll);
    vv.addEventListener("scroll", updateScroll);

    return () => {
      vv.removeEventListener("resize", updateScroll);
      vv.removeEventListener("scroll", updateScroll);
    };
  }, [messagesRef, isMobile]);
}

