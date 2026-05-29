import { beforeEach, describe, expect, it, vi } from "vitest";

function installIndexedDbStub() {
  const db = {
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => ({
      objectStore: () => ({
        get: () => {
          const request: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
          setTimeout(() => {
            request.result = undefined;
            request.onsuccess?.();
          }, 0);
          return request;
        },
        put: () => undefined,
      }),
      oncomplete: undefined as (() => void) | undefined,
      onerror: undefined as (() => void) | undefined,
      error: null,
    })),
  };

  vi.stubGlobal("indexedDB", {
    open: vi.fn(() => {
      const request: { result?: typeof db; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void; error?: unknown } = {};
      setTimeout(() => {
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      }, 0);
      return request;
    }),
  });
}

function installLocalStorageStub() {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    get length() {
      return values.size;
    },
  });
}

describe("json file storage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    installLocalStorageStub();
    installIndexedDbStub();
    vi.stubGlobal("showOpenFilePicker", undefined);
    vi.stubGlobal("showSaveFilePicker", undefined);
  });

  it("reads legacy localStorage values when no data file is connected", async () => {
    localStorage.setItem("darkMode", "true");
    localStorage.setItem("time-entries", JSON.stringify([{ id: "entry-1" }]));

    const { readJsonValue } = await import("./jsonFileStorage");

    await expect(readJsonValue("darkMode", false)).resolves.toBe(true);
    await expect(readJsonValue("time-entries", [])).resolves.toEqual([{ id: "entry-1" }]);
  });

  it("writes and removes fallback localStorage values", async () => {
    const { readJsonValue, removeJsonValue, writeJsonValue } = await import("./jsonFileStorage");

    await writeJsonValue("excludedCategories", ["Predi"]);
    expect(localStorage.getItem("excludedCategories")).toBe(JSON.stringify(["Predi"]));
    await expect(readJsonValue("excludedCategories", [])).resolves.toEqual(["Predi"]);

    await removeJsonValue("excludedCategories");
    expect(localStorage.getItem("excludedCategories")).toBeNull();
    await expect(readJsonValue("excludedCategories", ["fallback"])).resolves.toEqual(["fallback"]);
  });

  it("imports only supported keys and ignores invalid JSON payloads safely", async () => {
    const { importAllData, readJsonValue } = await import("./jsonFileStorage");

    await importAllData(new File([JSON.stringify({ setup: { completed: true }, unknown: "ignored" })], "data.json"));
    await expect(readJsonValue("setup", null)).resolves.toEqual({ completed: true });
    expect(localStorage.getItem("unknown")).toBeNull();

    await expect(importAllData(new File(["not-json"], "bad.json"))).rejects.toThrow();
    await expect(readJsonValue("setup", null)).resolves.toEqual({ completed: true });
  });
});
