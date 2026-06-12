import { Capacitor, registerPlugin } from '@capacitor/core';

interface TimerNotificationPlugin {
  start(options: { startTimeMs: number; title: string; body: string; category?: string }): Promise<void>;
  stop(): Promise<void>;
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

export async function stopTimerNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await TimerNotification.stop();
  } catch (e) {
    console.warn('[TimerNotif] stop:', e);
  }
}
