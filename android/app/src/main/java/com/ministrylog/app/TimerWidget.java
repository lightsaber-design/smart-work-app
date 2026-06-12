package com.ministrylog.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget de escritorio para MinistryLog.
 * Muestra el cronómetro activo con un Chronometer nativo.
 *
 * Los datos del timer se comparten con la app via SharedPreferences
 * escritas por TimerNotificationPlugin.
 *
 * Cuando el timer está corriendo, el botón "Detener" guarda una
 * acción pendiente en SharedPreferences y abre la app, que la
 * consume mediante consumeWidgetAction() al volver al frente.
 */
public class TimerWidget extends AppWidgetProvider {

    public static final String PREFS_NAME       = "MinistryLogWidget";
    public static final String KEY_RUNNING      = "timer_running";
    public static final String KEY_START_MS     = "timer_start_ms";
    public static final String KEY_CATEGORY     = "timer_category";
    public static final String KEY_PENDING_ACTION = "pending_widget_action";
    public static final String ACTION_CLOCK_OUT = "CLOCK_OUT";

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

        // Intent base para abrir la app
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (running && startMs > 0) {
            long wallElapsed = System.currentTimeMillis() - startMs;
            long base = SystemClock.elapsedRealtime() - wallElapsed;
            views.setChronometer(R.id.widget_elapsed, base, null, true);
            views.setTextViewText(
                R.id.widget_category,
                category.isEmpty() ? "⏱ En curso" : "⏱ " + category
            );

            // Botón detener: guarda acción pendiente + abre la app
            Intent stopIntent = new Intent(context, MainActivity.class);
            stopIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            stopIntent.putExtra("WIDGET_ACTION", ACTION_CLOCK_OUT);
            PendingIntent stopPi = PendingIntent.getActivity(
                context, 1, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            views.setViewVisibility(R.id.widget_stop_btn, View.VISIBLE);
            views.setOnClickPendingIntent(R.id.widget_stop_btn, stopPi);
            views.setOnClickPendingIntent(R.id.widget_root, openPi);
        } else {
            views.setChronometer(R.id.widget_elapsed, SystemClock.elapsedRealtime(), null, false);
            views.setTextViewText(R.id.widget_category, "Toca para abrir");
            views.setViewVisibility(R.id.widget_stop_btn, View.GONE);
            views.setOnClickPendingIntent(R.id.widget_root, openPi);
        }

        mgr.updateAppWidget(widgetId, views);
    }
}
