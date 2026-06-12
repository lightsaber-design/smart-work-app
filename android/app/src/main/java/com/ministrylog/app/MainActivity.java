package com.ministrylog.app;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(TimerNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        handleWidgetIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleWidgetIntent(intent);
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra("WIDGET_ACTION");
        if (TimerWidget.ACTION_CLOCK_OUT.equals(action)) {
            getSharedPreferences(TimerWidget.PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString(TimerWidget.KEY_PENDING_ACTION, TimerWidget.ACTION_CLOCK_OUT)
                .apply();
            // Limpiar el extra para evitar que se procese dos veces
            intent.removeExtra("WIDGET_ACTION");
        }
    }
}
