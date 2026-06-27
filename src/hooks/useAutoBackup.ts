import { useState, useEffect, useMemo } from "react";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { getDataSnapshot } from "@/lib/jsonFileStorage";
import { uploadToDrive } from "@/lib/googleDrive";
import type { SetupData } from "@/hooks/useSetup";

const BACKUP_DATE_KEY = "auto-backup-date";
const BACKUP_DATA_KEY = "auto-backup-snapshot";
const KEY_GDRIVE_USER = "gdrive-user";
const KEY_GDRIVE_LAST_SYNC = "gdrive-last-sync";
const LOCAL_BACKUP_INTERVAL = 24 * 60 * 60 * 1000;

function freqToMs(freq: SetupData["autoBackupFreq"]): number {
  if (freq === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (freq === "monthly") return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000; // daily
}

interface Options {
  setup?: Pick<SetupData, "autoBackupEnabled" | "autoBackupFreq">;
}

export function useAutoBackup({ setup }: Options = {}) {
  const [justBacked, setJustBacked] = useState(false);

  // Local snapshot backup — always runs daily
  useEffect(() => {
    const last = localStorage.getItem(BACKUP_DATE_KEY);
    if (!last || Date.now() - parseInt(last, 10) > LOCAL_BACKUP_INTERVAL) {
      try {
        localStorage.setItem(BACKUP_DATA_KEY, getDataSnapshot());
        localStorage.setItem(BACKUP_DATE_KEY, String(Date.now()));
        setJustBacked(true);
        const t = setTimeout(() => setJustBacked(false), 3500);
        return () => clearTimeout(t);
      } catch {
        // localStorage quota exceeded — skip silently
      }
    }
  }, []);

  // Drive auto-backup — fires once on mount if due and user is signed in
  useEffect(() => {
    if (!setup?.autoBackupEnabled) return;
    if (!localStorage.getItem(KEY_GDRIVE_USER)) return; // not signed in

    const lastSyncMs = parseInt(localStorage.getItem(KEY_GDRIVE_LAST_SYNC) ?? "0", 10);
    const intervalMs = freqToMs(setup.autoBackupFreq);
    if (Date.now() - lastSyncMs < intervalMs) return;

    GoogleAuth.refresh()
      .then((r) => uploadToDrive(r.accessToken, getDataSnapshot()))
      .then(() => localStorage.setItem(KEY_GDRIVE_LAST_SYNC, String(Date.now())))
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastBackupDate = useMemo(() => {
    const last = localStorage.getItem(BACKUP_DATE_KEY);
    return last ? new Date(parseInt(last, 10)) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justBacked]);

  return { justBacked, lastBackupDate };
}
