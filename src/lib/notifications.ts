import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'ministrylog-main';
let _notifId = 100;
let _channelReady = false;

// ── Android channel (obligatorio Android 8+) ─────────────────────────────────
async function ensureChannel(): Promise<void> {
  if (_channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'MinistryLog',
      description: 'Avisos de actividades y recordatorios',
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      vibration: true,
      lights: true,
      lightColor: '#34B1AF',
    });
    _channelReady = true;
  } catch (e) {
    console.warn('[Notif] createChannel failed:', e);
  }
}

// ── Pide permiso nativo y devuelve si fue concedido ──────────────────────────
async function requestNativePermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return true;
    if (display === 'denied') return false;
    const { display: after } = await LocalNotifications.requestPermissions();
    return after === 'granted';
  } catch (e) {
    console.warn('[Notif] requestPermission failed:', e);
    return false;
  }
}

// ── Inicialización al arrancar (llama desde App.tsx) ─────────────────────────
export async function initNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ensureChannel();
  await requestNativePermission();
}

// ── API pública ───────────────────────────────────────────────────────────────
export function canRequestNotificationPermission(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'default'
  );
}

export function requestNotificationPermission(): void {
  if (Capacitor.isNativePlatform()) {
    void requestNativePermission();
    return;
  }
  if (!canRequestNotificationPermission()) return;
  void Notification.requestPermission().catch((err) =>
    console.warn('[Notif] browser requestPermission failed:', err)
  );
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): boolean {
  if (Capacitor.isNativePlatform()) {
    void requestNativePermission().then((granted) => {
      if (!granted) return;
      const id = _notifId++;
      void LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body: (options?.body as string) ?? '',
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher_foreground',
            iconColor: '#34B1AF',
          },
        ],
      }).catch((e) => console.warn('[Notif] schedule failed:', e));
    });
    return true;
  }

  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }
  try {
    new Notification(title, options);
    return true;
  } catch (e) {
    console.warn('[Notif] browser Notification failed:', e);
    return false;
  }
}
