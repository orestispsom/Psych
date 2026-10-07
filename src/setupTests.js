import '@testing-library/jest-dom/vitest'

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function () {};

// This jsdom/Node combination doesn't wire up window.localStorage by
// default (Node's own experimental localStorage needs a --localstorage-file
// flag jsdom doesn't pass through). The app relies on localStorage for all
// profile/progress persistence, so give tests a minimal in-memory stand-in.
if (typeof window !== "undefined" && !window.localStorage) {
  class MemoryStorage {
    #store = new Map();
    get length() {
      return this.#store.size;
    }
    clear() {
      this.#store.clear();
    }
    getItem(key) {
      return this.#store.has(key) ? this.#store.get(key) : null;
    }
    setItem(key, value) {
      this.#store.set(key, String(value));
    }
    removeItem(key) {
      this.#store.delete(key);
    }
    key(index) {
      return Array.from(this.#store.keys())[index] ?? null;
    }
  }

  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
  });
}

// jsdom does not implement the native dialog top layer.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
