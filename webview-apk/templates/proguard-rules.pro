# Keep JavaScript bridge methods reachable from the web layer
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class {{PACKAGE_ID}}.NativeBridge { *; }
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-dontwarn android.webkit.**
