package com.ministrylog.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TimerNotification")
public class TimerNotificationPlugin extends Plugin {

    private static final int NOTIF_ID = 9001;
    private static final String CHANNEL_ID = "ministrylog-timer";

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "Timer activo",
                NotificationManager.IMPORTANCE_LOW
            );
            ch.setDescription("Muestra el tiempo transcurrido mientras el timer está en marcha");
            ch.setShowBadge(false);
            ch.enableVibration(false);
            ch.enableLights(false);
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            nm.createNotificationChannel(ch);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        long startTimeMs = call.getLong("startTimeMs", System.currentTimeMillis());
        String title = call.getString("title", "Timer activo");
        String body  = call.getString("body", "");

        Context ctx = getContext();

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            ctx, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int iconRes = ctx.getResources().getIdentifier(
            "ic_launcher_foreground", "drawable", ctx.getPackageName()
        );
        if (iconRes == 0) iconRes = android.R.drawable.ic_media_play;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setWhen(startTimeMs)
            .setUsesChronometer(true)
            .setChronometerCountDown(false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false)
            .setShowWhen(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setColor(0xFF34B1AF);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, builder.build());

        // Persist timer state for the home-screen widget
        String category = call.getString("category", "");
        saveWidgetState(ctx, true, startTimeMs, category);
        TimerWidget.refreshAll(ctx);

        call.resolve();
    }

    @PluginMethod
    public void consumeWidgetAction(PluginCall call) {
        Context ctx = getContext();
        android.content.SharedPreferences prefs =
            ctx.getSharedPreferences(TimerWidget.PREFS_NAME, Context.MODE_PRIVATE);
        String action = prefs.getString(TimerWidget.KEY_PENDING_ACTION, "");
        if (!action.isEmpty()) {
            prefs.edit().remove(TimerWidget.KEY_PENDING_ACTION).apply();
        }
        com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
        result.put("action", action);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(NOTIF_ID);

        // Clear timer state for the home-screen widget
        saveWidgetState(ctx, false, 0, "");
        TimerWidget.refreshAll(ctx);

        call.resolve();
    }

    private void saveWidgetState(Context ctx, boolean running, long startMs, String category) {
        SharedPreferences.Editor ed = ctx
            .getSharedPreferences(TimerWidget.PREFS_NAME, Context.MODE_PRIVATE)
            .edit();
        ed.putBoolean(TimerWidget.KEY_RUNNING, running);
        ed.putLong(TimerWidget.KEY_START_MS, startMs);
        ed.putString(TimerWidget.KEY_CATEGORY, category != null ? category : "");
        ed.apply();
    }
}
