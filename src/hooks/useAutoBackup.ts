import { useState, useEffect, useMemo } from "react";
import { getDataSnapshot } from "@/lib/jsonFileStorage";

const BACKUP_DATE_KEY = "auto-backup-date";
const BACKUP_DATA_KEY = "auto-backup-snapshot";
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000;

export function useAutoBackup() {
  const [justBacked, setJustBacked] = useState(false);

  useEffect(() => {
    const last = localStorage.getItem(BACKUP_DATE_KEY);
    if (!last || Date.now() - parseInt(last, 10) > BACKUP_INTERVAL) {
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

  const lastBackupDate = useMemo(() => {
    const last = localStorage.getItem(BACKUP_DATE_KEY);
    return last ? new Date(parseInt(last, 10)) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justBacked]);

  return { justBacked, lastBackupDate };
}
