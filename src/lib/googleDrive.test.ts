import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriveConflictError, uploadToDriveSafely } from "./googleDrive";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("uploadToDriveSafely", () => {
  const uploadCalls: string[] = [];

  beforeEach(() => {
    uploadCalls.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(remoteModifiedTime: string | null) {
    vi.stubGlobal("fetch", vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "PATCH" || opts?.method === "POST") {
        uploadCalls.push(String(url));
        return jsonResponse({ id: "file-1", name: "ministrylog-backup.json", modifiedTime: new Date().toISOString() });
      }
      // findBackupFile (GET)
      return jsonResponse({
        files: remoteModifiedTime ? [{ id: "file-1", name: "ministrylog-backup.json", modifiedTime: remoteModifiedTime }] : [],
      });
    }));
  }

  it("uploads when there is no existing remote backup", async () => {
    stubFetch(null);
    await uploadToDriveSafely("token", "{}", null);
    expect(uploadCalls).toHaveLength(1);
  });

  it("uploads when the remote backup is not newer than lastSyncMs", async () => {
    const lastSync = new Date(2026, 4, 10, 12, 0).getTime();
    stubFetch(new Date(2026, 4, 10, 11, 0).toISOString());
    await uploadToDriveSafely("token", "{}", lastSync);
    expect(uploadCalls).toHaveLength(1);
  });

  it("throws DriveConflictError when the remote backup is newer than lastSyncMs, without uploading", async () => {
    const lastSync = new Date(2026, 4, 10, 10, 0).getTime();
    stubFetch(new Date(2026, 4, 10, 12, 0).toISOString());
    await expect(uploadToDriveSafely("token", "{}", lastSync)).rejects.toBeInstanceOf(DriveConflictError);
    expect(uploadCalls).toHaveLength(0);
  });

  it("throws DriveConflictError when never synced before and a remote backup already exists", async () => {
    stubFetch(new Date(2026, 4, 10, 12, 0).toISOString());
    await expect(uploadToDriveSafely("token", "{}", null)).rejects.toBeInstanceOf(DriveConflictError);
    expect(uploadCalls).toHaveLength(0);
  });

  it("uploads anyway when force is set, even with a newer remote backup", async () => {
    const lastSync = new Date(2026, 4, 10, 10, 0).getTime();
    stubFetch(new Date(2026, 4, 10, 12, 0).toISOString());
    await uploadToDriveSafely("token", "{}", lastSync, { force: true });
    expect(uploadCalls).toHaveLength(1);
  });
});
