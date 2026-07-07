import { hasNotificationPermission, canRequestNotificationPermission, requestNotificationPermission } from "@/lib/notifications";

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

async function queryState(name: "geolocation" | "microphone"): Promise<PermissionState> {
  try {
    if (!navigator.permissions?.query) return "unsupported";
    const status = await navigator.permissions.query({ name: name as PermissionName });
    return status.state as PermissionState;
  } catch {
    return "unsupported";
  }
}

export async function getLocationPermissionState(): Promise<PermissionState> {
  return queryState("geolocation");
}

// No existe una API web para "pedir" el permiso de ubicación sin más: hay
// que disparar una petición real y que el propio prompt del sistema decida.
export function requestLocationPermission(): Promise<PermissionState> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve("unsupported"); return; }
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      () => resolve("denied"),
      { timeout: 10_000 }
    );
  });
}

export async function getMicrophonePermissionState(): Promise<PermissionState> {
  return queryState("microphone");
}

// Igual que con la ubicación: se pide abriendo brevemente el micrófono y
// cerrándolo enseguida, no hay una API de "solo permiso".
export async function requestMicrophonePermission(): Promise<PermissionState> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch {
    return "denied";
  }
}

export async function getNotifPermissionState(): Promise<PermissionState> {
  if (await hasNotificationPermission()) return "granted";
  return canRequestNotificationPermission() ? "prompt" : "denied";
}

export async function requestNotifPermission(): Promise<PermissionState> {
  return (await requestNotificationPermission()) ? "granted" : "denied";
}
