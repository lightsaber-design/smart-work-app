package com.ministrylog.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.widget.RemoteViews;

/**
 * Widget de escritorio para MinistryLog.
 * Muestra el cronómetro activo con un Chronometer nativo
 * (se actualiza cada segundo sin necesidad de refrescar el widget).
 *
 * Los datos del timer se comparten con la app via SharedPreferences
 * escritas por TimerNotificationPlugin.
 */
public class TimerWidget extends AppWidgetProvider {

    public static final String PREFS_NAME    = "MinistryLogWidget";
    public static final String KEY_RUNNING   = "timer_running";
    public static final String KEY_START_MS  = "timer_start_ms";
    public static final String KEY_CATEGORY  = "timer_category";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            updateWidget(context, mgr, id);
        }
    }

    /** Llamado desde TimerNotificationPlugin para refrescar todos los widgets. */
    public static void refreshAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(
            new android.content.ComponentName(context, TimerWidget.class)
        );
        for (int id : ids) {
            updateWidget(context, mgr, id);
        }
    }

    static void updateWidget(Context context, AppWidgetManager mgr, int widgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean running  = prefs.getBoolean(KEY_RUNNING, false);
        long    startMs  = prefs.getLong(KEY_START_MS, 0);
        String  category = prefs.getString(KEY_CATEGORY, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timer_widget);

        if (running && startMs > 0) {
            // Chronometer base: ajustamos el reloj de boot al inicio del timer
            long wallElapsed = System.currentTimeMillis() - startMs;
            long base = SystemClock.elapsedRealtime() - wallElapsed;
            views.setChronometer(R.id.widget_elapsed, base, null, true);
            views.setTextViewText(
                R.id.widget_category,
                category.isEmpty() ? "⏱ En curso" : "⏱ " + category
            );
        } else {
            // Cronómetro detenido — muestra 0:00 parado
            views.setChronometer(R.id.widget_elapsed, SystemClock.elapsedRealtime(), null, false);
            views.setTextViewText(R.id.widget_category, "Toca para abrir");
        }

        // Tap en cualquier parte → abrir la app
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pi);

        mgr.updateAppWidget(widgetId, views);
    }
}
