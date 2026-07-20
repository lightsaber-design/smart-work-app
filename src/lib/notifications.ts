import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Schedule } from '@capacitor/local-notifications';

const CHANNEL_ID = 'ministrylog-main';
const INTENT_KEY = '_ml_notif_intent';

// ── Enrutado de notificaciones ────────────────────────────────────────────────
// Cada notificación lleva en `extra` a qué pantalla debe llevar al usuario
// cuando la pulsa, en vez de abrir siempre la pantalla principal.
export type NotifNav =
  | { route: 'calendar'; eventId?: string }
  | { route: 'study'; contactId: string; sessionId?: string }
  | { route: 'estudios' }
  | { route: 'timer' }
  | { route: 'stats' };

export interface NotifIntent {
  /** Id de la acción pulsada: 'tap' (cuerpo) o un id de botón. */
  actionId: string;
  nav?: NotifNav;
}

interface ScheduleOpts {
  extra?: NotifNav;
  actionTypeId?: string;
}

// Tipo de acción con botones Sí/No para los recordatorios de estudio.
export const STUDY_ACTION_TYPE = 'STUDY_REMINDER';
export const STUDY_ACTION_DONE = 'STUDY_DONE';
export const STUDY_ACTION_SKIP = 'STUDY_SKIP';
/** Evento de ventana que se emite al pulsar una notificación. */
export const NOTIF_INTENT_EVENT = 'ml-notif-intent';

// ── Ids nativos deterministas ─────────────────────────────────────────────────
// El id numérico de cada notificación nativa se deriva SIEMPRE de su clave
// lógica (event.id, "unlogged-…", "report-deliver", etc.) con un hash estable.
// Así la misma notificación reutiliza el mismo id: reprogramarla la REEMPLAZA (no
// se acumulan duplicados aunque el efecto se re-ejecute o cambie el idioma) y
// cancelarla es fiable sin depender de un mapa que pudiera desincronizarse. Este
// es el arreglo de raíz de los avisos duplicados y de los que no se cancelaban.
function stableNotificationId(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0; // djb2 en 32 bits
  }
  return (h & 0x7fffffff) || 1; // positivo (int de Android) y distinto de 0
}

let _channelReady = false;

// Limpieza única por arranque: cancela TODAS las notificaciones nativas
// pendientes antes de reprogramar. Barre huérfanos de versiones anteriores que
// usaban ids incrementales (ya no localizables por clave). Como todos los efectos
// reprograman sus avisos —ahora con id determinista— tras la limpieza se
// reconstruye exactamente lo necesario. Promesa compartida: las llamadas
// concurrentes esperan a la MISMA limpieza y ninguna programa hasta que termina,
// así la limpieza nunca borra algo recién programado.
let _cleanupPromise: Promise<void> | null = null;
function cleanupStalePendingOnce(): Promise<void> {
  if (!_cleanupPromise) {
    _cleanupPromise = (async () => {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map((n) => ({ id: n.id })),
          });
        }
      } catch (e) {
        console.warn('[Notif] cleanup stale:', e);
      }
    })();
  }
  return _cleanupPromise;
}

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

// Lleva al usuario al ajuste de "Alarmas y recordatorios" si no está concedido.
// Sin alarmas exactas, Android retrasa o descarta los avisos con la app cerrada.
export async function ensureExactAlarms(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    if (exact_alarm !== 'granted') {
      await LocalNotifications.changeExactNotificationSetting();
    }
  } catch (e) {
    console.warn('[Notif] ensureExactAlarms:', e);
  }
}

// ── Botones Sí/No de los recordatorios de estudio ─────────────────────────────
// Las etiquetas vienen traducidas desde la app; sólo re-registramos si cambian.
let _studyActionSig = '';
export async function registerStudyActionType(
  yesLabel: string,
  noLabel: string
): Promise<void> {
  if (!isNativeAndroid()) return;
  const sig = `${yesLabel}|${noLabel}`;
  if (_studyActionSig === sig) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [{
        id: STUDY_ACTION_TYPE,
        actions: [
          { id: STUDY_ACTION_DONE, title: yesLabel },
          { id: STUDY_ACTION_SKIP, title: noLabel, destructive: true },
        ],
      }],
    });
    _studyActionSig = sig;
  } catch (e) {
    console.warn('[Notif] registerActionTypes:', e);
  }
}

// ── Intención pendiente al pulsar una notificación ────────────────────────────
// El listener puede dispararse en frío (app cerrada) antes de que React monte,
// así que guardamos la intención en memoria + localStorage hasta que la app la
// consuma.
let _pendingIntent: NotifIntent | null = null;
let _listenerReady = false;

function storeIntent(intent: NotifIntent): void {
  _pendingIntent = intent;
  try { localStorage.setItem(INTENT_KEY, JSON.stringify(intent)); } catch { /* memoria basta */ }
}

/** Lee la intención pendiente sin borrarla (para poder reintentar si los datos
 * aún no han cargado al abrir la app en frío). */
export function peekNotificationIntent(): NotifIntent | null {
  if (_pendingIntent) return _pendingIntent;
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (raw) { _pendingIntent = JSON.parse(raw) as NotifIntent; return _pendingIntent; }
  } catch { /* nada */ }
  return null;
}

/** Descarta la intención una vez gestionada. */
export function clearNotificationIntent(): void {
  _pendingIntent = null;
  try { localStorage.removeItem(INTENT_KEY); } catch { /* nada */ }
}

async function initNotificationListeners(): Promise<void> {
  if (_listenerReady || !Capacitor.isNativePlatform()) return;
  _listenerReady = true;
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = (event.notification.extra ?? undefined) as NotifNav | undefined;
      storeIntent({ actionId: event.actionId, nav: extra });

      // Borra la notificación de la bandeja tras actuar sobre ella. El tap del
      // cuerpo ya la descarta solo, pero los botones de acción no.
      const id = event.notification.id;
      if (typeof id === 'number') {
        void LocalNotifications.removeDeliveredNotifications({
          notifications: [{ id } as never],
        }).catch(() => { /* ya no estaba */ });
      }

      // Avisa a la app (si está en primer plano) para que actúe sin esperar foco.
      try { window.dispatchEvent(new Event(NOTIF_INTENT_EVENT)); } catch { /* nada */ }
    });
  } catch (e) {
    console.warn('[Notif] addListener:', e);
  }
}

export async function initNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ensureChannel();
  await initNotificationListeners();
}

export async function scheduleEventNotification(
  eventId: string,
  title: string,
  body: string,
  fireAt: Date,
  opts?: ScheduleOpts
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (fireAt.getTime() <= Date.now()) return false;

  const granted = await requestNativePermission();
  if (!granted) return false;

  // Barre huérfanos de arranques previos una sola vez antes de (re)programar.
  await cleanupStalePendingOnce();

  // Id determinista a partir de la clave lógica: si ya existe una notificación
  // con este id (misma clave), programarla la REEMPLAZA en vez de acumular otra.
  const id = stableNotificationId(eventId);

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
        ...(opts?.extra ? { extra: opts.extra } : {}),
        ...(opts?.actionTypeId ? { actionTypeId: opts.actionTypeId } : {}),
      }],
    });
    return true;
  } catch (e) {
    console.warn('[Notif] schedule:', e);
    return false;
  }
}

export async function cancelEventNotification(eventId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  // Mismo id determinista que al programar: cancela de forma fiable sin mapa.
  const id = stableNotificationId(eventId);
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // Cancelar una notificacion inexistente no requiere accion adicional.
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
    const granted = await requestNativePermission();
    // Tras conceder el permiso, asegura las alarmas exactas para que los avisos
    // lleguen puntuales con la app cerrada.
    if (granted) await ensureExactAlarms();
    return granted;
  }
  if (!canRequestNotificationPermission()) return false;
  try {
    return await Notification.requestPermission() === 'granted';
  } catch (e) {
    console.warn('[Notif] browser perm:', e);
    return false;
  }
}
