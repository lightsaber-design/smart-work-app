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
        // Acciones del widget de escritorio y de los atajos del icono (App
        // Shortcuts): se guardan tal cual para que la capa web las consuma
        // (CLOCK_IN, CLOCK_OUT, NAV|<pestaña>…).
        String action = intent.getStringExtra("WIDGET_ACTION");
        if (action != null && !action.isEmpty()) {
            getSharedPreferences(TimerWidget.PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString(TimerWidget.KEY_PENDING_ACTION, action)
                .apply();
            // Limpiar el extra para evitar que se procese dos veces
            intent.removeExtra("WIDGET_ACTION");
        }
    }
}
