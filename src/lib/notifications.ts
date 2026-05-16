export function canRequestNotificationPermission(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
}

export function requestNotificationPermission() {
  if (!canRequestNotificationPermission()) return;
  void Notification.requestPermission().catch((error) => {
    console.warn("Notification permission request failed:", error);
  });
}

export function showBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  try {
    new Notification(title, options);
    return true;
  } catch (error) {
    // Algunos navegadores moviles bloquean el constructor aunque el permiso este concedido.
    console.warn("Browser notification skipped:", error);
    return false;
  }
}
