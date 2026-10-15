/** Register asynchronous resources safely even when cancellation wins the race. */
export function createStreamCleanup() {
  let closed = false;
  const callbacks = new Set<() => void>();
  return {
    get closed() {
      return closed;
    },
    add(callback: () => void) {
      if (closed) callback();
      else callbacks.add(callback);
    },
    close() {
      if (closed) return;
      closed = true;
      for (const callback of callbacks) callback();
      callbacks.clear();
    },
  };
}
