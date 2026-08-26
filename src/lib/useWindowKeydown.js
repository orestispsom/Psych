import { useEffect, useRef } from "react";

/**
 * Register a window keydown listener exactly once, while always calling the
 * latest handler.
 *
 * Study-surface handlers close over the current question, selection and index,
 * so they change on every render. Passing them straight to useEffect either
 * re-binds the listener on every render (with no dependency array) or captures
 * stale state (with an empty one). Holding the handler in a ref avoids both.
 */
export function useWindowKeydown(handler) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = event => handlerRef.current?.(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}

export default useWindowKeydown;
