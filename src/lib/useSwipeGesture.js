import { useRef, useCallback } from "react";

/**
 * Hook for detecting horizontal touch swipe gestures (left/right) on mobile study surfaces.
 *
 * Distinguishes intentional horizontal navigation swipes from vertical scrolling
 * and ignores touches originating on interactive controls (buttons, inputs, etc.).
 *
 * @param {Object} options
 * @param {() => void} [options.onSwipeLeft] - Triggered on swipe left (navigate next)
 * @param {() => void} [options.onSwipeRight] - Triggered on swipe right (navigate previous)
 * @param {number} [options.minDistance=45] - Minimum horizontal swipe distance in pixels
 * @param {number} [options.maxDuration=600] - Maximum swipe duration in milliseconds
 * @param {boolean} [options.enabled=true] - Whether swipe listening is active
 * @returns {{ onTouchStart: Function, onTouchEnd: Function }} Touch event handlers to attach to container
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  minDistance = 45,
  maxDuration = 600,
  enabled = true,
} = {}) {
  const touchStartRef = useRef(null);
  const callbacksRef = useRef({ onSwipeLeft, onSwipeRight, enabled });

  callbacksRef.current = { onSwipeLeft, onSwipeRight, enabled };

  const isInteractiveTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toUpperCase();
    if (["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A", "LABEL"].includes(tagName)) return true;
    if (target.closest("button, input, textarea, select, a, [role='button'], .scale-box, .review-q-chip")) return true;
    return false;
  };

  const onTouchStart = useCallback((event) => {
    if (!callbacksRef.current.enabled || event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      ignored: isInteractiveTarget(event.target),
    };
  }, []);

  const onTouchEnd = useCallback((event) => {
    if (!callbacksRef.current.enabled || !touchStartRef.current || touchStartRef.current.ignored) {
      touchStartRef.current = null;
      return;
    }

    if (event.changedTouches.length !== 1) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;

    if (elapsed > maxDuration) return;

    // Check if horizontal movement is dominant (at least 1.4x the vertical delta)
    // and exceeds the minimum distance threshold
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX >= minDistance && absX > absY * 1.4) {
      if (deltaX < 0) {
        // Swiped left -> advance to next
        callbacksRef.current.onSwipeLeft?.();
      } else {
        // Swiped right -> go to previous
        callbacksRef.current.onSwipeRight?.();
      }
    }
  }, [maxDuration, minDistance]);

  return { onTouchStart, onTouchEnd };
}

export default useSwipeGesture;
