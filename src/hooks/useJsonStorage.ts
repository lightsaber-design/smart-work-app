import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import {
  createJsonDataFile,
  exportAllData,
  getJsonDataFileName,
  hasJsonDataFile,
  importAllData,
  initializeJsonStorage,
  isJsonFileStorageSupported,
  openJsonDataFile,
  subscribeJsonStorage,
} from "@/lib/jsonFileStorage";

const getSnapshot = () => `${hasJsonDataFile() ? "1" : "0"}:${getJsonDataFileName() ?? ""}`;

export function useJsonStorageStatus() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeJsonStorage()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to initialize JSON storage."))
      .finally(() => setReady(true));
  }, []);

  const snapshot = useSyncExternalStore(
    subscribeJsonStorage,
    getSnapshot,
    () => "0:"
  );
  const [connectedFlag, fileName] = snapshot.split(":");

  const createFile = useCallback(async () => {
    await createJsonDataFile();
    window.location.reload();
  }, []);

  const openFile = useCallback(async () => {
    await openJsonDataFile();
    window.location.reload();
  }, []);

  const exportData = useCallback(() => {
    exportAllData();
  }, []);

  const importData = useCallback(async (file: File) => {
    await importAllData(file);
    window.location.reload();
  }, []);

  return {
    ready,
    error,
    supported: isJsonFileStorageSupported(),
    connected: connectedFlag === "1",
    fileName: fileName || null,
    createFile,
    openFile,
    exportData,
    importData,
  };
}
