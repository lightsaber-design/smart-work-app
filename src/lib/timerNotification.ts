import { Capacitor, registerPlugin } from '@capacitor/core';

interface TimerNotificationPlugin {
  start(options: { startTimeMs: number; title: string; body: string; category?: string }): Promise<void>;
  pause(options: { elapsedMs: number; title: string; body: string }): Promise<void>;
  stop(): Promise<void>;
  consumeWidgetAction(): Promise<{ action: string }>;
  setCategories(options: { categories: { name: string; color: string }[] }): Promise<void>;
}

const TimerNotification = registerPlugin<TimerNotificationPlugin>('TimerNotification');

export async function startTimerNotification(startTime: Date, title: string, body: string, category?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await TimerNotification.start({ startTimeMs: startTime.getTime(), title, body, category });
  } catch (e) {
    console.warn('[TimerNotif] start:', e);
  }
}

// Congela la notificación persistente y el widget de escritorio mientras el
// timer está en pausa: sin esto, ambos seguían avanzando con el cronómetro
// nativo aunque la app mostrara el timer parado.
export async function pauseTimerNotification(elapsedMs: number, title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await TimerNotification.pause({ elapsedMs, title, body });
  } catch (e) {
    console.warn('[TimerNotif] pause:', e);
  }
}

export async function stopTimerNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await TimerNotification.stop();
  } catch (e) {
    console.warn('[TimerNotif] stop:', e);
  }
}

export async function setWidgetCategories(categories: { name: string; color: string }[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await TimerNotification.setCategories({ categories });
  } catch (e) {
    console.warn('[TimerNotif] setCategories:', e);
  }
}

export async function consumeWidgetAction(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return '';
  try {
    const result = await TimerNotification.consumeWidgetAction();
    return result.action ?? '';
  } catch (e) {
    console.warn('[TimerNotif] consumeWidgetAction:', e);
    return '';
  }
}
