type StorageKey =
  | "setup"
  | "time-entries"
  | "calendar-events"
  | "estudios"
  | "favorite-places"
  | "specialCampaign"
  | "monthly-report-carryover"
  | "darkMode"
  | "excludedCategories";

type AppData = Partial<Record<StorageKey, unknown>> & {
  schemaVersion?: number;
  updatedAt?: string;
};

type FilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
};

type OpenFilePickerOptions = {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
};

type FileSystemPermissionMode = "read" | "readwrite";

interface FileSystemFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  queryPermission(options?: { mode?: FileSystemPermissionMode }): Promise<PermissionState>;
  requestPermission(options?: { mode?: FileSystemPermissionMode }): Promise<PermissionState>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

const DB_NAME = "smart-work-json-storage";
const STORE_NAME = "handles";
const HANDLE_KEY = "data-file";
const JSON_TYPES = [{ description: "JSON data", accept: { "application/json": [".json"] } }];

let dataCache: AppData = {};
let handleCache: FileSystemFileHandle | null = null;
let readyPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemFileHandle | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function storeHandle(handle: FileSystemFileHandle) {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function parseData(text: string): AppData {
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  return typeof parsed === "object" && parsed !== null ? (parsed as AppData) : {};
}

function parseLegacyValue(key: string) {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  if (key === "darkMode") return raw === "true";
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function readLegacyBrowserData(): AppData {
  const legacyMap: Record<string, StorageKey> = {
    setup: "setup",
    "time-entries": "time-entries",
    "calendar-events": "calendar-events",
    estudios: "estudios",
    "favorite-places": "favorite-places",
    specialCampaign: "specialCampaign",
    "monthly-report-carryover": "monthly-report-carryover",
    darkMode: "darkMode",
    excludedCategories: "excludedCategories",
  };
  return Object.entries(legacyMap).reduce<AppData>((acc, [legacyKey, storageKey]) => {
    const value = parseLegacyValue(legacyKey);
    if (value !== undefined) acc[storageKey] = value;
    return acc;
  }, {});
}

function clearLegacyBrowserData() {
  [
    "setup",
    "time-entries",
    "calendar-events",
    "estudios",
    "favorite-places",
    "specialCampaign",
    "monthly-report-carryover",
    "darkMode",
    "excludedCategories",
  ].forEach((key) => localStorage.removeItem(key));
}

async function readFromHandle(handle: FileSystemFileHandle) {
  const file = await handle.getFile();
  dataCache = parseData(await file.text());
}

async function ensurePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const current = await handle.queryPermission({ mode: "readwrite" });
  if (current === "granted") return true;
  const requested = await handle.requestPermission({ mode: "readwrite" });
  return requested === "granted";
}

async function writeFile() {
  if (!handleCache) throw new Error("No JSON data file is connected.");
  if (!(await ensurePermission(handleCache))) throw new Error("JSON data file permission was denied.");

  const writable = await handleCache.createWritable();
  await writable.write(JSON.stringify({ ...dataCache, schemaVersion: 1, updatedAt: new Date().toISOString() }, null, 2));
  await writable.close();
}

export function isJsonFileStorageSupported() {
  return typeof window.showOpenFilePicker === "function" && typeof window.showSaveFilePicker === "function";
}

export function subscribeJsonStorage(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function initializeJsonStorage() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    dataCache = readLegacyBrowserData();
    const handle = await getStoredHandle();
    if (!handle || !(await ensurePermission(handle))) return;
    handleCache = handle;
    await readFromHandle(handle);
    notify();
  })();
  return readyPromise;
}

export function hasJsonDataFile() {
  return handleCache !== null;
}

export function getJsonDataFileName() {
  return handleCache?.name ?? null;
}

export async function createJsonDataFile() {
  if (!window.showSaveFilePicker) throw new Error("JSON file storage is not supported in this browser.");
  const handle = await window.showSaveFilePicker({
    suggestedName: "smart-work-data.json",
    types: JSON_TYPES,
  });
  handleCache = handle;
  await storeHandle(handle);
  dataCache = { ...readLegacyBrowserData(), ...dataCache };
  await writeFile();
  clearLegacyBrowserData();
  notify();
}

export async function openJsonDataFile() {
  if (!window.showOpenFilePicker) throw new Error("JSON file storage is not supported in this browser.");
  const [handle] = await window.showOpenFilePicker({ multiple: false, types: JSON_TYPES });
  if (!handle) return;
  handleCache = handle;
  await storeHandle(handle);
  await readFromHandle(handle);
  notify();
}

export async function readJsonValue<T>(key: StorageKey, fallback: T): Promise<T> {
  await initializeJsonStorage();
  return (dataCache[key] as T | undefined) ?? fallback;
}

export async function writeJsonValue(key: StorageKey, value: unknown) {
  await initializeJsonStorage();
  dataCache = { ...dataCache, [key]: value };
  if (!handleCache) {
    localStorage.setItem(key, key === "darkMode" ? String(value) : JSON.stringify(value));
    notify();
    return;
  }
  await writeFile();
}

export function exportAllData(): void {
  const blob = new Blob(
    [JSON.stringify({ ...dataCache, schemaVersion: 1, exportedAt: new Date().toISOString() }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ministrylog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const IMPORTABLE_KEYS: StorageKey[] = [
  'setup', 'time-entries', 'calendar-events', 'estudios',
  'favorite-places', 'specialCampaign', 'monthly-report-carryover',
  'darkMode', 'excludedCategories',
];

export async function importAllData(file: File): Promise<void> {
  const text = await file.text();
  const parsed = parseData(text);
  for (const key of IMPORTABLE_KEYS) {
    if (parsed[key] !== undefined) {
      dataCache = { ...dataCache, [key]: parsed[key] };
      if (!handleCache) {
        localStorage.setItem(key, key === 'darkMode' ? String(parsed[key]) : JSON.stringify(parsed[key]));
      }
    }
  }
  if (handleCache) await writeFile();
  notify();
}

export async function removeJsonValue(key: StorageKey) {
  await initializeJsonStorage();
  const next = { ...dataCache };
  delete next[key];
  dataCache = next;
  if (!handleCache) {
    localStorage.removeItem(key);
    notify();
    return;
  }
  await writeFile();
}
