import { beforeEach, describe, expect, it, vi } from "vitest";

function installIndexedDbStub() {
  const db = {
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => {
      const tx: { objectStore: () => unknown; oncomplete?: () => void; onerror?: () => void; error: null } = {
        objectStore: () => ({
          get: () => {
            const request: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
            setTimeout(() => {
              request.result = undefined;
              request.onsuccess?.();
            }, 0);
            return request;
          },
          put: () => {
            // storeHandle() asigna tx.oncomplete DESPUÉS de llamar a put(), así
            // que hay que esperar al siguiente tick para que ya esté asignado.
            setTimeout(() => tx.oncomplete?.(), 0);
          },
        }),
        oncomplete: undefined,
        onerror: undefined,
        error: null,
      };
      return tx;
    }),
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

  it("serializes writes to a connected file so a slow write can't overwrite a later one with stale data", async () => {
    const completedWrites: string[] = [];
    let createWritableCalls = 0;

    const fakeHandle = {
      kind: "file" as const,
      name: "data.json",
      getFile: async () => new File(["{}"], "data.json"),
      queryPermission: async () => "granted" as const,
      requestPermission: async () => "granted" as const,
      createWritable: async () => {
        const callIndex = ++createWritableCalls;
        return {
          write: async (data: string) => {
            // La primera escritura simula un disco lento; sin cola, la
            // segunda (más reciente) podría terminar y cerrar antes.
            if (callIndex === 1) await new Promise((resolve) => setTimeout(resolve, 30));
            completedWrites.push(data);
          },
          close: async () => undefined,
        };
      },
    };

    vi.stubGlobal("showSaveFilePicker", vi.fn(async () => fakeHandle));
    const { createJsonDataFile, writeJsonValue } = await import("./jsonFileStorage");
    await createJsonDataFile();
    // Ignora la escritura inicial de conexión: solo nos interesan las dos
    // escrituras concurrentes que provocamos a continuación.
    completedWrites.length = 0;
    createWritableCalls = 0;

    const first = writeJsonValue("excludedCategories", ["A"]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = writeJsonValue("darkMode", true);
    await Promise.all([first, second]);

    expect(completedWrites).toHaveLength(2);
    const lastWritten = JSON.parse(completedWrites[completedWrites.length - 1]);
    expect(lastWritten.excludedCategories).toEqual(["A"]);
    expect(lastWritten.darkMode).toBe(true);
  });
});
