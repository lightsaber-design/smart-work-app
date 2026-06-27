import { useState, useEffect, useCallback } from "react";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { uploadToDrive, downloadFromDrive, findBackupFile, DriveFile } from "@/lib/googleDrive";
import { getDataSnapshot, importAllData } from "@/lib/jsonFileStorage";

const KEY_USER = "gdrive-user";
const KEY_LAST_SYNC = "gdrive-last-sync";

export interface GDriveUser {
  email: string;
  name: string;
  imageUrl?: string;
}

export type SyncStatus = "idle" | "syncing" | "ok" | "error";

export interface GoogleDriveSync {
  user: GDriveUser | null;
  isSignedIn: boolean;
  status: SyncStatus;
  errorMsg: string | null;
  lastSync: Date | null;
  remoteFile: DriveFile | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  backup: () => Promise<void>;
  restore: () => Promise<void>;
}

function loadUser(): GDriveUser | null {
  try { return JSON.parse(localStorage.getItem(KEY_USER) ?? "null") as GDriveUser | null; }
  catch { return null; }
}

export function useGoogleDriveSync(): GoogleDriveSync {
  const [user, setUser] = useState<GDriveUser | null>(loadUser);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    const s = localStorage.getItem(KEY_LAST_SYNC);
    return s ? new Date(Number(s)) : null;
  });
  const [remoteFile, setRemoteFile] = useState<DriveFile | null>(null);
  // On mount: try to refresh session silently
  useEffect(() => {
    if (!user) return;
    GoogleAuth.refresh()
      .then((r) => {
        findBackupFile(r.accessToken).then(setRemoteFile).catch(() => null);
      })
      .catch(() => {
        localStorage.removeItem(KEY_USER);
        setUser(null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    try {
      const r = await GoogleAuth.refresh();
      return r.accessToken;
    } catch {
      throw new Error("Sesión expirada. Vuelve a iniciar sesión con Google.");
    }
  }, []);

  const signIn = useCallback(async () => {
    setStatus("syncing");
    setErrorMsg(null);
    try {
      const result = await GoogleAuth.signIn();
      const u: GDriveUser = {
        email: result.email,
        name: result.name ?? result.email,
        imageUrl: result.imageUrl,
      };
      localStorage.setItem(KEY_USER, JSON.stringify(u));
      setUser(u);
      // Check if a backup exists in Drive
      const file = await findBackupFile(result.authentication.accessToken);
      setRemoteFile(file);
      setStatus("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al iniciar sesión";
      setErrorMsg(msg);
      setStatus("error");
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    try { await GoogleAuth.signOut(); } catch { /* ignore */ }
    localStorage.removeItem(KEY_USER);
    setUser(null);
    setRemoteFile(null);
    setStatus("idle");
    setErrorMsg(null);
  }, []);

  const backup = useCallback(async () => {
    setStatus("syncing");
    setErrorMsg(null);
    try {
      const token = await getToken();
      const snapshot = getDataSnapshot();
      const file = await uploadToDrive(token, snapshot);
      setRemoteFile(file);
      const now = Date.now();
      localStorage.setItem(KEY_LAST_SYNC, String(now));
      setLastSync(new Date(now));
      setStatus("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al hacer copia de seguridad";
      setErrorMsg(msg);
      setStatus("error");
      throw e;
    }
  }, [getToken]);

  const restore = useCallback(async () => {
    setStatus("syncing");
    setErrorMsg(null);
    try {
      const token = await getToken();
      const json = await downloadFromDrive(token);
      const file = new File([json], "backup.json", { type: "application/json" });
      await importAllData(file);
      const now = Date.now();
      localStorage.setItem(KEY_LAST_SYNC, String(now));
      setLastSync(new Date(now));
      setStatus("ok");
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error
        ? (e.message === "NO_BACKUP" ? "No se encontró ninguna copia en Drive" : e.message)
        : "Error al restaurar";
      setErrorMsg(msg);
      setStatus("error");
      throw e;
    }
  }, [getToken]);

  return {
    user,
    isSignedIn: !!user,
    status,
    errorMsg,
    lastSync,
    remoteFile,
    signIn,
    signOut,
    backup,
    restore,
  };
}
