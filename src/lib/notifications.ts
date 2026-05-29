import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'ministrylog-main';
const NOTIF_ID_KEY = '_ml_notif_ids'; // localStorage map: eventId → notifId

// ── ID generator persistente ─────────────────────────────────────────────────
function loadNextId(): number {
  try { return Number(localStorage.getItem('_ml_notif_seq') ?? '100') || 100; }
  catch { return 100; }
}
function saveNextId(n: number) {
  try { localStorage.setItem('_ml_notif_seq', String(n)); } catch {}
}
let _nextId = loadNextId();
function nextId(): number {
  const id = _nextId++;
  saveNextId(_nextId);
  return id;
}

// ── Mapa eventId → notifId (para poder cancelar) ─────────────────────────────
function loadIdMap(): Map<string, number> {
  try {
    const raw = localStorage.getItem(NOTIF_ID_KEY);
    if (raw) return new Map(JSON.parse(raw) as [string, number][]);
  } catch {}
  return new Map();
}
function saveIdMap(map: Map<string, number>) {
  try { localStorage.setItem(NOTIF_ID_KEY, JSON.stringify([...map])); } catch {}
}
const _idMap = loadIdMap();

// ── Canal Android ─────────────────────────────────────────────────────────────
let _channelReady = false;
async function ensureChannel(): Promise<void> {
  if (_channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'MinistryLog',
      description: 'Avisos de actividades y recordatorios',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#34B1AF',
    });
    _channelReady = true;
  } catch (e) { console.warn('[Notif] createChannel:', e); }
}

// ── Permiso ───────────────────────────────────────────────────────────────────
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

// ── Inicialización al arrancar ────────────────────────────────────────────────
export async function initNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ensureChannel();
  await requestNativePermission();
}

// ── Pre-programar notificación para un evento futuro (dispara con app cerrada) ─
export async function scheduleEventNotification(
  eventId: string,
  title: string,
  body: string,
  fireAt: Date
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (fireAt.getTime() <= Date.now()) return; // ya pasó
  const granted = await requestNativePermission();
  if (!granted) return;

  // Cancela la anterior si existe
  await cancelEventNotification(eventId);

  const id = nextId();
  _idMap.set(eventId, id);
  saveIdMap(_idMap);

  await LocalNotifications.schedule({
    notifications: [{
      id,
      title,
      body,
      channelId: CHANNEL_ID,
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#34B1AF',
      schedule: { at: fireAt, allowWhileIdle: true },
    }],
  }).catch((e) => console.warn('[Notif] schedule:', e));
}

// ── Cancelar notificación programada de un evento ────────────────────────────
export async function cancelEventNotification(eventId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const id = _idMap.get(eventId);
  if (id === undefined) return;
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch {}
  _idMap.delete(eventId);
  saveIdMap(_idMap);
}

// ── Notificación inmediata (para cuando la app está abierta) ─────────────────
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
      }).catch((e) => console.warn('[Notif] schedule (immediate):', e));
    });
    return true;
  }

  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) return false;

  try { new Notification(title, options); return true; }
  catch (e) { console.warn('[Notif] browser:', e); return false; }
}

// ── API pública de permisos ───────────────────────────────────────────────────
export function canRequestNotificationPermission(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default';
}
export function requestNotificationPermission(): void {
  if (Capacitor.isNativePlatform()) { void requestNativePermission(); return; }
  if (!canRequestNotificationPermission()) return;
  void Notification.requestPermission().catch((e) => console.warn('[Notif] browser perm:', e));
}
