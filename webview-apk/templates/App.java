package {{PACKAGE_ID}};

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import androidx.appcompat.app.AppCompatDelegate;

public class App extends Application {

    public static final String CHANNEL_ID = "armox_default";

    @Override
    public void onCreate() {
        super.onCreate();

        // ---- Dark mode policy (config: theme.dark_mode) ----
        AppCompatDelegate.setDefaultNightMode({{NIGHT_MODE}});

        // ---- Local notification channel (native feature, helps Play policy 4.3) ----
        if ({{LOCAL_NOTIFICATIONS}} && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.notif_channel),
                    NotificationManager.IMPORTANCE_DEFAULT);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }
}
