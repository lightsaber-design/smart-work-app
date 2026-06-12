# Capacitor core — keep plugin bridge and JS interface intact
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }

# App package
-keep class com.ministrylog.app.** { *; }

# Keep all methods annotated with @JavascriptInterface (WebView bridge)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX / AppCompat
-keep class androidx.appcompat.** { *; }

# Preserve line numbers in stack traces for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
