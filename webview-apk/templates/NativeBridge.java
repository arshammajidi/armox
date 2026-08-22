package {{PACKAGE_ID}};

import android.app.Activity;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/**
 * پل ارتباطی جاوااسکریپت <-> اندروید
 * در صفحه وب با window.{{BRIDGE_NAME}}.method() صدا زده می‌شود.
 * وجود این قابلیت‌های نیتیو یکی از دلایل قبول شدن اپ در سیاست
 * Minimum Functionality گوگل‌پلی است.
 */
public class NativeBridge {

    private final Activity activity;

    public NativeBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void toast(String message) {
        activity.runOnUiThread(() ->
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface
    public void vibrate(int ms) {
        Vibrator v = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            v.vibrate(ms);
        }
    }

    @JavascriptInterface
    public void share(String text, String url) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, (text == null ? "" : text) + " " + (url == null ? "" : url));
        activity.startActivity(Intent.createChooser(i, null));
    }

    @JavascriptInterface
    public void copy(String text) {
        ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("text", text));
    }

    @JavascriptInterface
    public void openBrowser(String url) {
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) {
        }
    }

    @JavascriptInterface
    public void notify(String title, String body) {
        if (!{{LOCAL_NOTIFICATIONS}}) return;
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(
                android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(activity, App.CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(activity).notify((int) System.currentTimeMillis(), b.build());
        } catch (SecurityException ignored) {
        }
    }

    @JavascriptInterface
    public void cancelNotifications() {
        NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();
    }

    @JavascriptInterface
    public String deviceInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("platform", "android");
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("release", Build.VERSION.RELEASE);
            o.put("model", Build.MODEL);
            o.put("manufacturer", Build.MANUFACTURER);
            o.put("appVersion", BuildConfig.VERSION_NAME);
            o.put("packageName", activity.getPackageName());
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public boolean isOnline() {
        return NetUtil.isOnline(activity);
    }

    @JavascriptInterface
    public void exit() {
        activity.runOnUiThread(activity::finishAffinity);
    }
}
