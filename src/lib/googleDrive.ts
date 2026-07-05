const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const BACKUP_NAME = "ministrylog-backup.json";
const SPACE = "appDataFolder";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

async function req(url: string, token: string, opts: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text()}`);
  return res;
}

export async function findBackupFile(token: string): Promise<DriveFile | null> {
  const url = `${DRIVE_API}/files?spaces=${SPACE}&fields=files(id,name,modifiedTime,size)&q=name='${BACKUP_NAME}'`;
  const data = await (await req(url, token)).json() as { files: DriveFile[] };
  return data.files?.[0] ?? null;
}

export async function uploadToDrive(token: string, json: string): Promise<DriveFile> {
  const existing = await findBackupFile(token);
  const meta = existing
    ? { name: BACKUP_NAME }
    : { name: BACKUP_NAME, parents: [SPACE] };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([json], { type: "application/json" }));

  const url = existing
    ? `${DRIVE_UPLOAD}/files/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const method = existing ? "PATCH" : "POST";
  return await (await req(url, token, { method, body: form })).json() as DriveFile;
}

export async function downloadFromDrive(token: string): Promise<string> {
  const file = await findBackupFile(token);
  if (!file) throw new Error("NO_BACKUP");
  return await (await req(`${DRIVE_API}/files/${file.id}?alt=media`, token)).text();
}

export class DriveConflictError extends Error {
  constructor(public remoteFile: DriveFile) {
    super("DRIVE_CONFLICT");
    this.name = "DriveConflictError";
  }
}

/**
 * Sube el snapshot a Drive, pero antes comprueba que no exista ya una copia
 * remota más reciente que `lastSyncMs` (la última vez que este dispositivo
 * sincronizó con Drive, en cualquier sentido). uploadToDrive() por sí solo
 * era "el último que escribe gana": si otro dispositivo había subido una
 * copia más nueva que este todavía no había descargado, se perdía en
 * silencio al subir la propia. Si hay conflicto, no sobrescribe — lanza
 * DriveConflictError para que el llamador decida (forzar tras confirmar con
 * el usuario, o simplemente omitir el guardado en el caso de un auto-backup
 * silencioso sin nadie delante para confirmar nada).
 */
export async function uploadToDriveSafely(
  token: string,
  json: string,
  lastSyncMs: number | null,
  options: { force?: boolean } = {}
): Promise<DriveFile> {
  if (!options.force) {
    const existing = await findBackupFile(token);
    if (existing && (!lastSyncMs || new Date(existing.modifiedTime).getTime() > lastSyncMs)) {
      throw new DriveConflictError(existing);
    }
  }
  return uploadToDrive(token, json);
}
