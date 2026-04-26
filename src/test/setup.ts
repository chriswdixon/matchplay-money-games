import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// matchMedia polyfill
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// IntersectionObserver polyfill
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds = [];
}
(globalThis as any).IntersectionObserver = IO;
(globalThis as any).ResizeObserver = IO;

// scrollTo no-op
window.scrollTo = vi.fn();

// localStorage-backed crypto.randomUUID fallback (jsdom has it, but be safe)
if (!globalThis.crypto?.randomUUID) {
  (globalThis.crypto as any) = {
    ...(globalThis.crypto || {}),
    randomUUID: () =>
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }),
  };
}
