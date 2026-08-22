package {{PACKAGE_ID}};

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

import java.util.List;

public class MainActivity extends AppCompatActivity {

    // ---------- تنظیمات تولیدشده از config.json ----------
    private static final boolean FULLSCREEN         = {{FULLSCREEN}};
    private static final boolean HIDE_STATUS_BAR    = {{HIDE_STATUS_BAR}};
    private static final boolean HIDE_NAV_BAR       = {{HIDE_NAV_BAR}};
    private static final boolean EDGE_TO_EDGE       = {{EDGE_TO_EDGE}};
    private static final boolean KEEP_SCREEN_ON     = {{KEEP_SCREEN_ON}};
    private static final boolean LOCAL_MODE         = {{LOCAL_MODE}};
    private static final String  START_URL          = "{{START_URL}}";
    private static final String[] ALLOWED_HOSTS     = { {{ALLOWED_HOSTS}} };
    private static final boolean PULL_TO_REFRESH    = {{PULL_TO_REFRESH}};
    private static final boolean EXTERNAL_IN_BROWSER= {{EXTERNAL_IN_BROWSER}};
    private static final boolean FILE_UPLOAD        = {{FILE_UPLOAD}};
    private static final boolean DOWNLOADS          = {{DOWNLOADS}};
    private static final boolean GEOLOCATION        = {{GEOLOCATION}};
    private static final boolean CAMERA_MIC         = {{CAMERA_MIC}};
    private static final boolean JS_BRIDGE          = {{JS_BRIDGE}};
    private static final boolean OFFLINE_PAGE       = {{OFFLINE_PAGE}};
    private static final boolean BACK_HISTORY       = {{BACK_HISTORY}};
    private static final boolean EXIT_CONFIRM       = {{EXIT_CONFIRM}};
    private static final boolean LONG_PRESS_MENU    = {{LONG_PRESS_MENU}};
    private static final boolean DEBUG_WEBVIEW      = {{DEBUG_WEBVIEW}};

    private WebView web;
    private SwipeRefreshLayout swipe;
    private ProgressBar progress;
    private View offlineView;
    private WebViewAssetLoader assetLoader;
    private long lastBackPress = 0L;
    private boolean pageFailed = false;

    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private PermissionRequest pendingWebPermission;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        web = findViewById(R.id.webview);
        swipe = findViewById(R.id.swipe);
        progress = findViewById(R.id.progress);
        offlineView = findViewById(R.id.offline);
        findViewById(R.id.retry).setOnClickListener(v -> reload());

        setupWindow();
        setupWebView();
        setupClients();
        setupFileChooser();
        askNotificationPermission();

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            loadStart();
        }
    }

    // ---------------------------------------------------------------
    // فول‌اسکرین / لبه‌به‌لبه
    // ---------------------------------------------------------------
    private void setupWindow() {
        if (KEEP_SCREEN_ON) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        WindowCompat.setDecorFitsSystemWindows(getWindow(), !EDGE_TO_EDGE);

        if (FULLSCREEN) {
            WindowInsetsControllerCompat c =
                    WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            c.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            if (HIDE_STATUS_BAR) c.hide(WindowInsetsCompat.Type.statusBars());
            if (HIDE_NAV_BAR) c.hide(WindowInsetsCompat.Type.navigationBars());
        }

        // اگر فول‌اسکرین نیست، پدینگ امن اعمال می‌شود تا محتوا زیر نوارها نرود
        if (!FULLSCREEN && EDGE_TO_EDGE) {
            ViewCompat.setOnApplyWindowInsetsListener(swipe, (v, insets) -> {
                int top = insets.getInsets(WindowInsetsCompat.Type.systemBars()).top;
                int bottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
                v.setPadding(0, top, 0, bottom);
                return insets;
            });
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && FULLSCREEN) setupWindow();
    }

    // ---------------------------------------------------------------
    // تنظیمات وب‌ویو
    // ---------------------------------------------------------------
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled({{JAVASCRIPT}});
        s.setDomStorageEnabled({{DOM_STORAGE}});
        s.setDatabaseEnabled({{DATABASE}});
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom({{ZOOM}});
        s.setBuiltInZoomControls({{ZOOM}});
        s.setDisplayZoomControls(false);
        s.setTextZoom({{TEXT_ZOOM}});
        s.setMediaPlaybackRequiresUserGesture(!{{MEDIA_AUTOPLAY}});
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setCacheMode({{CACHE_MODE}});
        s.setMixedContentMode({{MIXED_CONTENT}});
        s.setUserAgentString(s.getUserAgentString() + " {{UA_SUFFIX}}");
        if ({{DESKTOP_MODE}}) {
            s.setUserAgentString("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 {{UA_SUFFIX}}");
        }

        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(getResources().getColor(R.color.app_background, getTheme()));

        if (!LONG_PRESS_MENU) {
            web.setOnLongClickListener(v -> true);
            web.setHapticFeedbackEnabled(false);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, {{THIRD_PARTY_COOKIES}});

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(s, {{SAFE_BROWSING}});
        }

        if (DEBUG_WEBVIEW) WebView.setWebContentsDebuggingEnabled(true);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        swipe.setEnabled(PULL_TO_REFRESH);
        swipe.setOnRefreshListener(this::reload);

        if (JS_BRIDGE) {
            web.addJavascriptInterface(new NativeBridge(this), "{{BRIDGE_NAME}}");
        }

        if (DOWNLOADS) {
            web.setDownloadListener((url, userAgent, contentDisposition, mimeType, size) -> {
                try {
                    DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                    String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    r.setMimeType(mimeType);
                    r.addRequestHeader("User-Agent", userAgent);
                    r.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                    r.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) dm.enqueue(r);
                    Toast.makeText(this, name, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    openExternally(url);
                }
            });
        }
    }

    private void setupClients() {
        web.setWebViewClient(new WebViewClient() {

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                if (LOCAL_MODE) return assetLoader.shouldInterceptRequest(req.getUrl());
                return super.shouldInterceptRequest(view, req);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();

                // لینک‌های غیر http مثل tel: mailto: intent: whatsapp:
                if (!scheme.startsWith("http")) {
                    openExternally(uri.toString());
                    return true;
                }
                if (!EXTERNAL_IN_BROWSER || isInternal(uri)) return false;
                openExternally(uri.toString());
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                pageFailed = false;
                if (progress != null) progress.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipe.setRefreshing(false);
                if (progress != null) progress.setVisibility(View.GONE);
                if (OFFLINE_PAGE) {
                    offlineView.setVisibility(pageFailed ? View.VISIBLE : View.GONE);
                    web.setVisibility(pageFailed ? View.GONE : View.VISIBLE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req,
                                        android.webkit.WebResourceError err) {
                if (req.isForMainFrame()) pageFailed = true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progress == null) return;
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (!FILE_UPLOAD) return false;
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    fileChooserLauncher.launch(params.createIntent());
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (!CAMERA_MIC) {
                    request.deny();
                    return;
                }
                pendingWebPermission = request;
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin, android.webkit.GeolocationPermissions.Callback callback) {
                if (!GEOLOCATION) {
                    callback.invoke(origin, false, false);
                    return;
                }
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 42);
                }
                callback.invoke(origin, true, false);
            }
        });
    }

    private void setupFileChooser() {
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(), result -> {
                    if (filePathCallback == null) return;
                    Uri[] uris = null;
                    Intent data = result.getData();
                    if (result.getResultCode() == RESULT_OK && data != null) {
                        if (data.getClipData() != null) {
                            int n = data.getClipData().getItemCount();
                            uris = new Uri[n];
                            for (int i = 0; i < n; i++) {
                                uris[i] = data.getClipData().getItemAt(i).getUri();
                            }
                        } else if (data.getData() != null) {
                            uris = new Uri[]{data.getData()};
                        }
                    }
                    filePathCallback.onReceiveValue(uris);
                    filePathCallback = null;
                });
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 43);
        }
    }

    // ---------------------------------------------------------------
    // کمکی‌ها
    // ---------------------------------------------------------------
    private void loadStart() {
        if (!LOCAL_MODE && OFFLINE_PAGE && !NetUtil.isOnline(this)) {
            offlineView.setVisibility(View.VISIBLE);
            web.setVisibility(View.GONE);
            return;
        }
        offlineView.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        web.loadUrl(START_URL);
    }

    private void reload() {
        if (web.getUrl() == null) loadStart();
        else if (!LOCAL_MODE && !NetUtil.isOnline(this)) {
            swipe.setRefreshing(false);
            Toast.makeText(this, R.string.offline_message, Toast.LENGTH_SHORT).show();
        } else {
            offlineView.setVisibility(View.GONE);
            web.setVisibility(View.VISIBLE);
            web.reload();
        }
    }

    private boolean isInternal(Uri uri) {
        String host = uri.getHost();
        if (host == null) return true;
        if (LOCAL_MODE && host.equals("appassets.androidplatform.net")) return true;
        for (String h : ALLOWED_HOSTS) {
            if (host.equals(h) || host.endsWith("." + h)) return true;
        }
        return false;
    }

    private void openExternally(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception e) {
            Toast.makeText(this, url, Toast.LENGTH_SHORT).show();
        }
    }

    // ---------------------------------------------------------------
    // چرخه حیات + دکمه بازگشت
    // ---------------------------------------------------------------
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (BACK_HISTORY && web.canGoBack()) {
                web.goBack();
                return true;
            }
            if (EXIT_CONFIRM) {
                long now = System.currentTimeMillis();
                if (now - lastBackPress > 2000) {
                    lastBackPress = now;
                    Toast.makeText(this, R.string.exit_confirm, Toast.LENGTH_SHORT).show();
                    return true;
                }
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        List<String> ignored = java.util.Arrays.asList(permissions);
        if (pendingWebPermission != null) pendingWebPermission = null;
    }
}
