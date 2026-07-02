package com.ministrylog.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget de escritorio para MinistryLog: un temporizador circular grande,
 * con el mismo aspecto que el círculo de la app.
 *
 * Funciona de forma autónoma (sin abrir la app):
 *  - Parado: muestra la última categoría usada (por defecto) dentro del círculo,
 *    con un botón ▶ central. Tocar el chip de categoría la cambia a la siguiente.
 *    Tocar ▶ arranca el cronómetro con esa categoría al instante.
 *  - Corriendo: muestra el cronómetro nativo + la categoría + un botón ⏹.
 *
 * El anillo y el botón central se dibujan como Bitmap, tintados con el color de
 * la categoría, para conseguir el círculo redondo (los widgets no soportan SVG).
 *
 * Los botones disparan broadcasts a este mismo receiver (onReceive), que actualiza
 * SharedPreferences y refresca el widget. La acción de fichar se deja como
 * "pendiente" para que la app, al volver al frente, la sincronice con la marca
 * de tiempo exacta mediante consumeWidgetAction().
 */
public class TimerWidget extends AppWidgetProvider {

    public static final String PREFS_NAME         = "MinistryLogWidget";
    public static final String KEY_RUNNING        = "timer_running";
    public static final String KEY_START_MS       = "timer_start_ms";
    public static final String KEY_CATEGORY       = "timer_category";
    public static final String KEY_CATEGORIES     = "timer_categories"; // JSON [{name,color}]
    public static final String KEY_PENDING_ACTION = "pending_widget_action";

    public static final String ACTION_CLOCK_IN  = "com.ministrylog.app.WIDGET_CLOCK_IN";
    public static final String ACTION_CLOCK_OUT = "com.ministrylog.app.WIDGET_CLOCK_OUT";
    public static final String ACTION_CYCLE_CAT = "com.ministrylog.app.WIDGET_CYCLE_CATEGORY";
    public static final String EXTRA_CATEGORY   = "category";

    // ── Tamaños base (al tamaño mínimo del widget, 110dp). Crecen con `scale`
    // cuando el usuario agranda el widget en la pantalla de inicio. ──────────────
    private static final float ACTION_BTN_BASE_DP = 40f;
    private static final float CATEGORY_BASE_SP   = 10f;
    private static final float CLOCK_BASE_SP      = 25f;
    private static final float REFERENCE_WIDGET_DP = 110f;
    private static final float MAX_WIDGET_SCALE     = 3f;

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            updateWidget(context, mgr, id);
        }
    }

    /** El usuario arrastró los bordes del widget: recalcular con el nuevo tamaño. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int widgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, mgr, widgetId, newOptions);
        updateWidget(context, mgr, widgetId);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_CLOCK_IN.equals(action)) {
            String category = intent.getStringExtra(EXTRA_CATEGORY);
            if (category == null || category.isEmpty()) category = currentCategory(context);
            long now = System.currentTimeMillis();
            saveWidgetState(context, true, now, category);
            setPendingAction(context, "CLOCK_IN|" + now + "|" + category);
            refreshAll(context);
        } else if (ACTION_CLOCK_OUT.equals(action)) {
            long now = System.currentTimeMillis();
            String lastCat = currentCategory(context); // conserva la categoría como predeterminada
            saveWidgetState(context, false, 0, lastCat);
            setPendingAction(context, "CLOCK_OUT|" + now);
            refreshAll(context);
        } else if (ACTION_CYCLE_CAT.equals(action)) {
            cycleCategory(context);
            refreshAll(context);
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

        String[][] cats = readCategories(prefs);
        String category = currentCategory(context);
        int catColor = colorForCategory(cats, category);
        float scale = widgetScale(mgr, widgetId);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timer_widget);

        // Tocar el fondo siempre abre la app
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_ring, openPi);

        // Anillo y botón dibujados como bitmap, tintados con el color de la categoría.
        // El botón se dibuja más grande cuanto más grande sea el widget en pantalla.
        views.setImageViewBitmap(R.id.widget_ring, buildRing(catColor, running));
        views.setImageViewBitmap(R.id.widget_action_btn, buildActionButton(catColor, running, scale));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            float btnDp = ACTION_BTN_BASE_DP * scale;
            views.setViewLayoutWidth(R.id.widget_action_btn, btnDp, TypedValue.COMPLEX_UNIT_DIP);
            views.setViewLayoutHeight(R.id.widget_action_btn, btnDp, TypedValue.COMPLEX_UNIT_DIP);
        }

        // Chip de categoría (texto tintado, fondo redondeado estático)
        views.setTextViewText(R.id.widget_category, category);
        views.setTextColor(R.id.widget_category, running ? 0xFFFFFFFF : catColor);
        views.setTextViewTextSize(R.id.widget_category, TypedValue.COMPLEX_UNIT_SP, CATEGORY_BASE_SP * scale);
        views.setTextViewTextSize(R.id.widget_elapsed, TypedValue.COMPLEX_UNIT_SP, CLOCK_BASE_SP * scale);
        views.setTextViewTextSize(R.id.widget_idle_title, TypedValue.COMPLEX_UNIT_SP, CLOCK_BASE_SP * scale);

        if (running && startMs > 0) {
            // ── Corriendo: cronómetro + ⏹ ──
            long wallElapsed = System.currentTimeMillis() - startMs;
            long base = SystemClock.elapsedRealtime() - wallElapsed;
            views.setChronometer(R.id.widget_elapsed, base, null, true);
            views.setViewVisibility(R.id.widget_elapsed, View.VISIBLE);
            views.setViewVisibility(R.id.widget_idle_title, View.GONE);

            Intent stopIntent = new Intent(context, TimerWidget.class);
            stopIntent.setAction(ACTION_CLOCK_OUT);
            PendingIntent stopPi = PendingIntent.getBroadcast(
                context, 1, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_action_btn, stopPi);
            // El chip no cambia categoría mientras corre: tocarlo abre la app
            views.setOnClickPendingIntent(R.id.widget_category, openPi);
        } else {
            // ── Parado: última categoría + ▶ ──
            views.setChronometer(R.id.widget_elapsed, SystemClock.elapsedRealtime(), null, false);
            views.setViewVisibility(R.id.widget_elapsed, View.GONE);
            views.setViewVisibility(R.id.widget_idle_title, View.VISIBLE);
            views.setTextViewText(R.id.widget_idle_title, "0:00");

            Intent inIntent = new Intent(context, TimerWidget.class);
            inIntent.setAction(ACTION_CLOCK_IN);
            inIntent.putExtra(EXTRA_CATEGORY, category);
            inIntent.setData(Uri.parse("ministrylog://widget/clockin/" + Uri.encode(category)));
            PendingIntent inPi = PendingIntent.getBroadcast(
                context, 2, inIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_action_btn, inPi);

            // Tocar el chip cambia a la siguiente categoría
            Intent cycleIntent = new Intent(context, TimerWidget.class);
            cycleIntent.setAction(ACTION_CYCLE_CAT);
            cycleIntent.setData(Uri.parse("ministrylog://widget/cycle"));
            PendingIntent cyclePi = PendingIntent.getBroadcast(
                context, 3, cycleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_category, cyclePi);
        }

        mgr.updateAppWidget(widgetId, views);
    }

    /**
     * Factor de escala respecto al tamaño mínimo del widget (110dp). 1.0 al
     * tamaño mínimo/por defecto; crece si el usuario lo agranda en su pantalla
     * de inicio, así el botón ▶/⏹ y los textos aprovechan el espacio real en
     * vez de quedarse siempre en el tamaño mínimo.
     */
    private static float widgetScale(AppWidgetManager mgr, int widgetId) {
        Bundle options = mgr.getAppWidgetOptions(widgetId);
        int widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, (int) REFERENCE_WIDGET_DP);
        int heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, (int) REFERENCE_WIDGET_DP);
        int side = Math.min(widthDp, heightDp);
        if (side <= 0) return 1f;
        float scale = side / REFERENCE_WIDGET_DP;
        if (scale < 1f) scale = 1f;
        if (scale > MAX_WIDGET_SCALE) scale = MAX_WIDGET_SCALE;
        return scale;
    }

    // ── Categoría ───────────────────────────────────────────────────────────────

    /** Categoría predeterminada = última usada; si no hay, la primera de la lista. */
    private static String currentCategory(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String cat = prefs.getString(KEY_CATEGORY, "");
        if (cat != null && !cat.isEmpty()) return cat;
        String[][] cats = readCategories(prefs);
        return cats.length > 0 ? cats[0][0] : "Predi";
    }

    /** Avanza la categoría seleccionada a la siguiente de la lista. */
    private static void cycleCategory(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String[][] cats = readCategories(prefs);
        if (cats.length == 0) return;
        String cur = currentCategory(ctx);
        int idx = 0;
        for (int i = 0; i < cats.length; i++) {
            if (cats[i][0].equals(cur)) { idx = i; break; }
        }
        String next = cats[(idx + 1) % cats.length][0];
        prefs.edit().putString(KEY_CATEGORY, next).apply();
    }

    private static int colorForCategory(String[][] cats, String name) {
        for (String[] c : cats) {
            if (c[0].equals(name)) {
                try { return Color.parseColor(c[1]); }
                catch (IllegalArgumentException ignored) { return 0xFF34B1AF; }
            }
        }
        return 0xFF34B1AF;
    }

    private static int withAlpha(int color, int alpha) {
        return (alpha << 24) | (color & 0x00FFFFFF);
    }

    // ── Dibujo del círculo ───────────────────────────────────────────────────────

    /** Anillo circular: fondo oscuro translúcido + pista + acento de categoría. */
    private static Bitmap buildRing(int catColor, boolean running) {
        int size = 400;
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        float cx = size / 2f, cy = size / 2f;
        float stroke = size * 0.045f;
        float r = cx - stroke;

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        // Relleno: oscuro translúcido, con un tinte de categoría más fuerte si corre
        p.setStyle(Paint.Style.FILL);
        p.setShader(new LinearGradient(
            0, 0, size, size,
            running ? withAlpha(catColor, 0x55) : withAlpha(catColor, 0x22),
            0xF21A1A2E,
            Shader.TileMode.CLAMP
        ));
        c.drawCircle(cx, cy, r, p);
        p.setShader(null);

        // Pista (track) tenue
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(stroke);
        p.setColor(0x33FFFFFF);
        c.drawCircle(cx, cy, r, p);

        // Acento de categoría
        p.setColor(running ? withAlpha(catColor, 0xFF) : withAlpha(catColor, 0x99));
        p.setStrokeCap(Paint.Cap.ROUND);
        if (running) {
            // Anillo completo cuando corre
            c.drawCircle(cx, cy, r, p);
        } else {
            // Un arco parcial cuando está parado (acento visual)
            RectF oval = new RectF(cx - r, cy - r, cx + r, cy + r);
            c.drawArc(oval, -90, 110, false, p);
        }

        return bmp;
    }

    /** Botón central con degradado de categoría y glifo ▶ / ■. Escala con `scale`. */
    private static Bitmap buildActionButton(int catColor, boolean running, float scale) {
        int size = Math.round(160 * scale);
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        float cx = size / 2f, cy = size / 2f;
        float r = cx - size * 0.06f;

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.FILL);
        if (running) {
            // Stop: círculo translúcido blanco
            p.setColor(0x33FFFFFF);
            c.drawCircle(cx, cy, r, p);
        } else {
            // Play: degradado de categoría
            p.setShader(new LinearGradient(
                0, 0, size, size,
                lighten(catColor, 0.12f), catColor, Shader.TileMode.CLAMP
            ));
            c.drawCircle(cx, cy, r, p);
            p.setShader(null);
        }

        // Glifo blanco
        p.setColor(0xFFFFFFFF);
        if (running) {
            // Cuadrado (stop)
            float s = r * 0.62f;
            c.drawRoundRect(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2, s * 0.18f, s * 0.18f, p);
        } else {
            // Triángulo (play), ligeramente desplazado a la derecha
            float t = r * 0.55f;
            Path tri = new Path();
            float off = t * 0.12f;
            tri.moveTo(cx - t * 0.5f + off, cy - t * 0.6f);
            tri.lineTo(cx - t * 0.5f + off, cy + t * 0.6f);
            tri.lineTo(cx + t * 0.7f + off, cy);
            tri.close();
            c.drawPath(tri, p);
        }
        return bmp;
    }

    private static int lighten(int color, float amount) {
        int r = (int) Math.min(255, Color.red(color)   + 255 * amount);
        int g = (int) Math.min(255, Color.green(color) + 255 * amount);
        int b = (int) Math.min(255, Color.blue(color)  + 255 * amount);
        return Color.argb(Color.alpha(color), r, g, b);
    }

    // ── Persistencia ──────────────────────────────────────────────────────────────

    /** Lee las categorías guardadas por la app; si no hay, usa los valores por defecto. */
    private static String[][] readCategories(SharedPreferences prefs) {
        String json = prefs.getString(KEY_CATEGORIES, "");
        if (json != null && !json.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(json);
                if (arr.length() > 0) {
                    String[][] out = new String[arr.length()][2];
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject o = arr.getJSONObject(i);
                        out[i][0] = o.optString("name", "Predi");
                        out[i][1] = o.optString("color", "#34B1AF");
                    }
                    return out;
                }
            } catch (org.json.JSONException ignored) {
                // cae a los valores por defecto
            }
        }
        return new String[][] {
            { "Predi",   "#34B1AF" },
            { "Carrito", "#7CC67E" },
            { "LDC",     "#9668A2" },
            { "Visitas", "#F4CFA4" },
            { "Estudio", "#D07D7D" },
        };
    }

    private static void setPendingAction(Context ctx, String value) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PENDING_ACTION, value)
            .apply();
    }

    private static void saveWidgetState(Context ctx, boolean running, long startMs, String category) {
        SharedPreferences.Editor ed = ctx
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit();
        ed.putBoolean(KEY_RUNNING, running);
        ed.putLong(KEY_START_MS, startMs);
        ed.putString(KEY_CATEGORY, category != null ? category : "");
        ed.apply();
    }
}
