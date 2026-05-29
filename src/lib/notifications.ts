import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Schedule } from '@capacitor/local-notifications';

const CHANNEL_ID = 'ministrylog-main';
const NOTIF_ID_KEY = '_ml_notif_ids';

// Generador persistente para evitar reutilizar ids de notificaciones.
function loadNextId(): number {
  try {
    return Number(localStorage.getItem('_ml_notif_seq') ?? '100') || 100;
  } catch {
    return 100;
  }
}

function saveNextId(n: number) {
  try {
    localStorage.setItem('_ml_notif_seq', String(n));
  } catch {
    // Si localStorage no esta disponible, se mantiene la secuencia en memoria.
  }
}

let _nextId = loadNextId();
function nextId(): number {
  const id = _nextId++;
  saveNextId(_nextId);
  return id;
}

// Relaciona cada evento con su notificacion para poder cancelarla despues.
function loadIdMap(): Map<string, number> {
  try {
    const raw = localStorage.getItem(NOTIF_ID_KEY);
    if (raw) return new Map(JSON.parse(raw) as [string, number][]);
  } catch {
    // Si el mapa persistido esta corrupto, se empieza con un mapa limpio.
  }
  return new Map();
}

function saveIdMap(map: Map<string, number>) {
  try {
    localStorage.setItem(NOTIF_ID_KEY, JSON.stringify([...map]));
  } catch {
    // El plugin nativo sigue funcionando aunque no podamos guardar el mapa.
  }
}

const _idMap = loadIdMap();
let _channelReady = false;

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

// Crea el canal de Android sin pedir permisos al arrancar la app.
async function ensureChannel(): Promise<void> {
  if (_channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'MinistryLog',
      description: 'Activity alerts and reminders',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#34B1AF',
    });
    _channelReady = true;
  } catch (e) {
    console.warn('[Notif] createChannel:', e);
  }
}

async function requestNativePermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return true;
    if (display === 'denied') return false;
    const { display: after } = await LocalNotifications.requestPermissions();
    return after === 'granted';
  } catch (e) {
    console.warn('[Notif] requestPermission:', e);
    return false;
  }
}

async function canUseExactAlarms(): Promise<boolean> {
  if (!isNativeAndroid()) return true;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    return exact_alarm === 'granted';
  } catch (e) {
    console.warn('[Notif] exact alarm setting:', e);
    return false;
  }
}

export async function initNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ensureChannel();
}

export async function scheduleEventNotification(
  eventId: string,
  title: string,
  body: string,
  fireAt: Date
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (fireAt.getTime() <= Date.now()) return false;

  const granted = await requestNativePermission();
  if (!granted) return false;

  await cancelEventNotification(eventId);

  const id = nextId();
  _idMap.set(eventId, id);
  saveIdMap(_idMap);

  const schedule: Schedule = { at: fireAt };
  if (await canUseExactAlarms()) {
    schedule.allowWhileIdle = true;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title,
        body,
        channelId: CHANNEL_ID,
        smallIcon: 'ic_launcher_foreground',
        iconColor: '#34B1AF',
        schedule,
      }],
    });
    return true;
  } catch (e) {
    _idMap.delete(eventId);
    saveIdMap(_idMap);
    console.warn('[Notif] schedule:', e);
    return false;
  }
}

export async function cancelEventNotification(eventId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const id = _idMap.get(eventId);
  if (id === undefined) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // Cancelar una notificacion inexistente no requiere accion adicional.
  }
  _idMap.delete(eventId);
  saveIdMap(_idMap);
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): boolean {
  if (Capacitor.isNativePlatform()) {
    void requestNativePermission().then((granted) => {
      if (!granted) return;
      void LocalNotifications.schedule({
        notifications: [{
          id: nextId(),
          title,
          body: (options?.body as string) ?? '',
          channelId: CHANNEL_ID,
          smallIcon: 'ic_launcher_foreground',
          iconColor: '#34B1AF',
        }],
      }).catch((e) => console.warn('[Notif] schedule immediate:', e));
    });
    return true;
  }

  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) return false;

  try {
    new Notification(title, options);
    return true;
  } catch (e) {
    console.warn('[Notif] browser:', e);
    return false;
  }
}

export function canRequestNotificationPermission(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default';
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { display } = await LocalNotifications.checkPermissions();
      return display === 'granted';
    } catch (e) {
      console.warn('[Notif] checkPermission:', e);
      return false;
    }
  }
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return requestNativePermission();
  }
  if (!canRequestNotificationPermission()) return false;
  try {
    return await Notification.requestPermission() === 'granted';
  } catch (e) {
    console.warn('[Notif] browser perm:', e);
    return false;
  }
}
