import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwipeGesture } from "./useSwipeGesture";

describe("useSwipeGesture", () => {
  it("triggers onSwipeLeft on a valid horizontal swipe left", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight, minDistance: 40 })
    );

    const target = document.createElement("div");

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 200, clientY: 100 }],
        target,
      });
    });

    act(() => {
      result.current.onTouchEnd({
        changedTouches: [{ clientX: 120, clientY: 105 }],
      });
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("triggers onSwipeRight on a valid horizontal swipe right", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight, minDistance: 40 })
    );

    const target = document.createElement("div");

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 100, clientY: 100 }],
        target,
      });
    });

    act(() => {
      result.current.onTouchEnd({
        changedTouches: [{ clientX: 180, clientY: 95 }],
      });
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("ignores predominantly vertical scrolling gestures", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight, minDistance: 40 })
    );

    const target = document.createElement("div");

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 100, clientY: 100 }],
        target,
      });
    });

    // deltaX = -50, deltaY = 150 -> vertical scrolling dominates
    act(() => {
      result.current.onTouchEnd({
        changedTouches: [{ clientX: 50, clientY: 250 }],
      });
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("ignores touches starting on interactive elements like buttons", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight, minDistance: 40 })
    );

    const button = document.createElement("button");

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 200, clientY: 100 }],
        target: button,
      });
    });

    act(() => {
      result.current.onTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
