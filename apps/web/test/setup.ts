import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node 25 trae un localStorage global propio que, sin --localstorage-file, no
// tiene métodos y tapa el de jsdom. En ese caso se usa uno en memoria.
function almacenamientoEnMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => void datos.set(k, String(v)),
  };
}
for (const nombre of ["localStorage", "sessionStorage"] as const) {
  if (typeof globalThis[nombre]?.clear !== "function") {
    Object.defineProperty(globalThis, nombre, {
      value: almacenamientoEnMemoria(),
      configurable: true,
    });
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.fontSize = "";
});

// jsdom no implementa del todo <dialog>: lo justo para los tests.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
