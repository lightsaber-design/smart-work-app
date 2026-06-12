import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import type { EstudioContact } from "@/hooks/useEstudios";
import { scheduleEventNotification, cancelEventNotification } from "@/lib/notifications";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/** Lunes de la semana actual a las 00:00:00. */
function currentWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Dom
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

/** Próximo domingo a las 20:00. Si ya pasó hoy (domingo >20:00), avanza una semana. */
function nextSundayEvening(): Date {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  const dow = d.getDay(); // 0=Dom
  d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow));
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  return d;
}

export function useStudyNotifications({
  contacts,
  isTimerRunning,
  t,
}: {
  contacts: EstudioContact[];
  isTimerRunning: boolean;
  t: TranslateFn;
}) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isTimerRunning) return;

    const now = Date.now();
    const today = new Date();
    const todayStr = today.toDateString();
    const weekStartMs = currentWeekStart().getTime();
    const weekKey = currentWeekStart().toDateString();

    contacts.forEach((contact) => {
      const fixedId = `study-fixed-${contact.id}`;
      const flexId = `study-flex-${contact.id}`;

      if (!contact.active || !contact.schedule) {
        void cancelEventNotification(fixedId);
        void cancelEventNotification(flexId);
        return;
      }

      const { schedule } = contact;

      // Last completed session context
      const lastDone = contact.sessions
        .filter((s) => s.pending === false)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;
      const lessonSuffix = lastDone?.lesson
        ? t("notif_study_ctx_lesson").replace("{lesson}", lastDone.lesson)
        : "";

      if (schedule.dayOfWeek !== undefined) {
        // Cancelar posible notificación flexible residual si el usuario cambió el tipo
        void cancelEventNotification(flexId);

        // Solo actuar el día programado
        if (today.getDay() !== schedule.dayOfWeek) return;

        // Si ya se hizo el estudio hoy, cancelar cualquier notificación pendiente
        const doneToday = contact.sessions.some(
          (s) => !s.pending && new Date(s.date).toDateString() === todayStr
        );
        if (doneToday) {
          void cancelEventNotification(fixedId);
          return;
        }

        // Comprobar que han pasado al menos 90 min desde la hora programada
        const [h, m] = schedule.time.split(":").map(Number);
        const scheduledMs = new Date(today).setHours(h, m, 0, 0);
        if (now < scheduledMs + 90 * 60_000) return;

        // Disparar una sola vez al día
        const storageKey = `_sn_fixed_${contact.id}_${todayStr}`;
        if (localStorage.getItem(storageKey)) return;
        localStorage.setItem(storageKey, "1");

        void scheduleEventNotification(
          fixedId,
          t("notif_study_missed_title"),
          t("notif_study_missed_today", { name: contact.name }) + lessonSuffix,
          new Date(Date.now() + 1_000),
        );

      } else {
        // Cancelar posible notificación de día fijo residual
        void cancelEventNotification(fixedId);

        // Si ya se hizo el estudio esta semana, cancelar la notificación del domingo
        const doneThisWeek = contact.sessions.some(
          (s) => !s.pending && new Date(s.date).getTime() >= weekStartMs
        );
        if (doneThisWeek) {
          void cancelEventNotification(flexId);
          return;
        }

        // Programar una sola vez por semana para el próximo domingo a las 20:00
        const storageKey = `_sn_flex_${contact.id}_${weekKey}`;
        if (localStorage.getItem(storageKey)) return;
        localStorage.setItem(storageKey, "1");

        void scheduleEventNotification(
          flexId,
          t("notif_study_missed_title"),
          t("notif_study_missed_week", { name: contact.name }) + lessonSuffix,
          nextSundayEvening(),
        );
      }
    });
  }, [contacts, isTimerRunning, t]);
}
