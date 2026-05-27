import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let _notifId = 1;

async function requestNativePermission(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return true;
  const { display: after } = await LocalNotifications.requestPermissions();
  return after === 'granted';
}

export function canRequestNotificationPermission(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default';
}

export function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    void requestNativePermission();
    return;
  }
  if (!canRequestNotificationPermission()) return;
  void Notification.requestPermission().catch((error) => {
    console.warn('Notification permission request failed:', error);
  });
}

export function showBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (Capacitor.isNativePlatform()) {
    void requestNativePermission().then((granted) => {
      if (!granted) return;
      void LocalNotifications.schedule({
        notifications: [{
          id: _notifId++,
          title,
          body: (options?.body as string) ?? '',
          smallIcon: 'ic_launcher',
          iconColor: '#34B1AF',
        }],
      });
    });
    return true;
  }

  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }
  try {
    new Notification(title, options);
    return true;
  } catch (error) {
    console.warn('Browser notification skipped:', error);
    return false;
  }
}
