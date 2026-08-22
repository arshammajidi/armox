# آموزش ساخت اپ WebView اندروید با پایتون (APK/AAB) — بدون بلاک شدن در گوگل‌پلی

این پوشه یک **بیلدر پایتونی** است: شما فقط `config.json` را ویرایش می‌کنید و اسکریپت،
یک پروژه‌ی کامل و بومی اندروید (Java + Gradle) می‌سازد و از آن `APK` یا `AAB` بیرون می‌دهد.
اپ خروجی **فول‌اسکرین**، **آفلاین‌پذیر** و **کاملاً قابل تنظیم** است و طوری نوشته شده که
سیاست‌های ۲۰۲۵/۲۰۲۶ گوگل‌پلی (Minimum Functionality و Webviews & Affiliate Spam) را رد نکند.

---

## فهرست

1. [چرا این روش و نه Kivy/Buildozer؟](#۱-چرا-این-روش)
2. [نصب پیش‌نیازها](#۲-پیشنیازها)
3. [شروع سریع در ۵ دقیقه](#۳-شروع-سریع)
4. [تنظیمات کامل config.json](#۴-تنظیمات-کامل-configjson)
5. [فول‌اسکرین چطور کار می‌کند](#۵-فولاسکرین)
6. [پل جاوااسکریپت (قابلیت‌های نیتیو داخل صفحه وب)](#۶-پل-جاوااسکریپت)
7. [امضا کردن اپ (keystore)](#۷-امضای-اپ)
8. [بلاک نشدن در گوگل‌پلی — چک‌لیست عملی](#۸-چکلیست-گوگلپلی)
9. [تست، دیباگ و مشکلات رایج](#۹-عیبیابی)

---

## ۱. چرا این روش؟

| روش | نتیجه |
|---|---|
| **Kivy + Buildozer** | پایتون واقعی داخل اپ، ولی APK ~۲۰-۴۰ مگابایت، استارت کند، WebView از طریق `pyjnius` ناقص، به‌روزرسانی targetSdk دردسر دارد. برای اپ WebView توصیه نمی‌شود. |
| **BeeWare / Toga** | همان مشکلات + اکوسیستم کوچک‌تر. |
| **پایتون به‌عنوان تولیدکننده‌ی پروژه‌ی نیتیو (این پروژه)** | APK نهایی ~۲-۳ مگابایت، استارت آنی، همه‌ی APIهای اندروید در دسترس، سازگار با target API 35/36. پایتون کار «ساخت و پیکربندی» را می‌کند نه اجرای رانتایم. |

نکته‌ی مهم: گوگل‌پلی به **زبان ساخت** کاری ندارد؛ به **کیفیت و ارزش افزوده‌ی اپ** کار دارد.
پس بهترین استراتژی این است که خروجی، یک اپ نیتیو تمیز باشد و پایتون فقط ابزار ساخت باشد.

---

## ۲. پیش‌نیازها

```bash
# 1) جاوا ۱۷ (اجباری برای Android Gradle Plugin 8.x)
sudo apt update && sudo apt install -y openjdk-17-jdk unzip
java -version         # باید 17.x باشد

# 2) پایتون ۳.۸+ (اختیاری: Pillow برای ساخت آیکون در چند سایز)
pip install pillow

# 3) بررسی محیط
cd webview-apk
python3 build_apk.py doctor

# 4) نصب خودکار Android SDK (اگر نصب نبود؛ حدود ۱ گیگ دانلود)
python3 build_apk.py sdk
```

> ویندوز: همین دستورها در PowerShell کار می‌کند؛ فقط JDK 17 را از Adoptium نصب کنید و
> `JAVA_HOME` را ست کنید. (اگر Android Studio دارید، SDK از قبل موجود است و مرحله‌ی ۴ لازم نیست.)

---

## ۳. شروع سریع

```bash
cd webview-apk

# پیش‌نمایش سایت/فایل html قبل از بیلد
python3 serve.py                       # http://localhost:8080

# ساخت نسخه‌ی دیباگ برای تست روی گوشی
python3 build_apk.py build --debug
# خروجی: webview-apk/build/out/1.0.0-app-debug.apk

# نصب روی گوشی متصل با USB
adb install -r build/out/1.0.0-app-debug.apk

# نسخه‌ی ریلیز برای گوگل‌پلی (بعد از ساخت keystore)
python3 build_apk.py keystore
python3 build_apk.py build --format aab
```

دستورهای موجود:

| دستور | کار |
|---|---|
| `doctor` | بررسی جاوا و Android SDK |
| `sdk` | دانلود و نصب خودکار SDK + پذیرش لایسنس‌ها |
| `keystore` | ساخت کلید امضای ریلیز |
| `generate` | فقط تولید سورس پروژه‌ی اندروید (قابل باز کردن در Android Studio) |
| `build` | تولید + کامپایل APK/AAB |
| `clean` | پاک کردن خروجی‌ها |

---

## ۴. تنظیمات کامل `config.json`

### app — هویت اپ
| کلید | توضیح |
|---|---|
| `name` | نامی که زیر آیکون دیده می‌شود |
| `package_id` | شناسه‌ی یکتا مثل `com.yourbrand.app` — **بعد از انتشار قابل تغییر نیست** |
| `version_name` / `version_code` | نسخه‌ی نمایشی و عددی (برای هر آپلود در پلی باید `version_code` زیاد شود) |
| `icon` | مسیر یک PNG مربعی ۱۰۲۴×۱۰۲۴ (خالی = آیکون تک‌رنگ ساخته می‌شود) |

### content — محتوا
```jsonc
"mode": "local"      // local = فایل‌های وب داخل APK (آفلاین کامل)
                      // remote = بارگذاری از یک آدرس https
"local_web_dir": "../",              // پوشه‌ای که index.html در آن است
"start_url": "https://example.com",  // فقط در حالت remote
"allowed_hosts": ["example.com"]     // دامنه‌های داخلی؛ بقیه لینک‌ها در مرورگر باز می‌شوند
```
در حالت `local` فایل‌ها با `WebViewAssetLoader` روی دامنه‌ی امن
`https://appassets.androidplatform.net/assets/www/` سرو می‌شوند (نه `file://`) تا
`localStorage`، `fetch`، Service Worker و CORS درست کار کنند.

### fullscreen
| کلید | اثر |
|---|---|
| `enabled` | فعال‌سازی حالت تمام‌صفحه |
| `hide_status_bar` / `hide_navigation_bar` | مخفی کردن نوار بالا/پایین |
| `edge_to_edge` | محتوا تا لبه‌ی نمایشگر و زیر بریدگی (notch) کشیده می‌شود |
| `orientation` | `portrait` / `landscape` / `sensor` / `auto` |
| `keep_screen_on` | صفحه خاموش نشود (مناسب ویدیو/داشبورد) |

### theme
رنگ‌ها را با `#RRGGBB` بدهید: `primary_color`، `background_color`، `status_bar_color`،
`navigation_bar_color`، `splash_background`، به‌علاوه `light_status_bar_icons` (آیکون‌های تیره روی پس‌زمینه‌ی روشن)
و `dark_mode` با مقادیر `system` / `dark` / `light`.

### webview
`javascript`, `dom_storage`, `database`, `zoom`, `text_zoom`, `user_agent_suffix`,
`desktop_mode`, `cache_mode` (`default|no_cache|cache_first|cache_only`),
`allow_mixed_content`, `third_party_cookies`, `media_autoplay`, `safe_browsing`,
`long_press_menu` (منوی کپی/انتخاب متن)، `pull_to_refresh`,
`open_external_links_in_browser`, `file_upload`, `downloads`, `geolocation`,
`camera_microphone`, `debug_webview`.

### features
`js_bridge` + `bridge_name`، `offline_page`، `splash_screen` + `splash_duration_ms`،
`back_navigates_history`، `exit_confirm` + متن آن، `local_notifications`،
`deep_link_hosts` (باز شدن لینک‌های سایت شما مستقیم در اپ).

### permissions / sdk / signing / build
مجوزها فقط وقتی به مانیفست اضافه می‌شوند که `true` باشند — این دقیقاً همان چیزی است که
ریویوی گوگل دوست دارد (کمترین مجوز ممکن). `sdk.target_sdk` را زیر ۳۵ نگذارید.

---

## ۵. فول‌اسکرین

پیاده‌سازی با `WindowInsetsControllerCompat` انجام شده (روش رسمی و سازگار با اندروید ۱۵):

```java
WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
c.setSystemBarsBehavior(BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
c.hide(WindowInsetsCompat.Type.statusBars());
c.hide(WindowInsetsCompat.Type.navigationBars());
```

* کاربر با سوایپ از لبه، نوارها را موقتاً می‌بیند و بعد دوباره مخفی می‌شوند (immersive sticky).
* پس از بستن کیبورد یا برگشت به اپ، فول‌اسکرین دوباره اعمال می‌شود (`onWindowFocusChanged`).
* در سمت CSS حتماً از `viewport-fit=cover` و `env(safe-area-inset-*)` استفاده کنید:

```css
body { padding: env(safe-area-inset-top) env(safe-area-inset-right)
                env(safe-area-inset-bottom) env(safe-area-inset-left); }
```

> از API قدیمی `SYSTEM_UI_FLAG_*` استفاده نشده چون در اندروید ۱۱+ منسوخ است و در ۱۵ رفتار ناپایدار دارد.

---

## ۶. پل جاوااسکریپت

اگر `features.js_bridge = true` باشد، داخل صفحه‌ی وب این‌ها در دسترس است
(نام شیء = `features.bridge_name`، پیش‌فرض `Armox`):

```js
Armox.toast("سلام");
Armox.vibrate(40);
Armox.share("متن", "https://site.com");
Armox.copy("کپی در کلیپ‌بورد");
Armox.openBrowser("https://example.com");
Armox.notify("عنوان", "متن نوتیفیکیشن");   // نوتیفیکیشن محلی
Armox.cancelNotifications();
Armox.isOnline();                          // true/false
JSON.parse(Armox.deviceInfo());            // مدل، اندروید، نسخه اپ ...
Armox.exit();
```

تشخیص اینکه در اپ هستیم یا مرورگر:

```js
const isApp = typeof window.Armox !== "undefined";
if (isApp) document.body.classList.add("in-app");
```

**همین قابلیت‌ها هستند که اپ شما را از «یک بوکمارک» به «اپ» تبدیل می‌کنند** و
دلیل اصلی رد شدن در سیاست 4.3 گوگل را از بین می‌برند.

---

## ۷. امضای اپ

```bash
# 1) در config.json بخش signing را پر کنید (رمزها را عوض کنید) و enabled=true
# 2) ساخت کلید
python3 build_apk.py keystore
# 3) بیلد ریلیز
python3 build_apk.py build --format aab
```

⚠️ فایل `release.keystore` و رمزهایش را در جای امن نگه دارید (و در گیت کامیت نکنید —
`.gitignore` این کار را انجام می‌دهد). گم شدن آن یعنی دیگر نمی‌توانید همان اپ را آپدیت کنید،
مگر با Play App Signing و درخواست ریست کلید.

بررسی امضای خروجی:
```bash
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs build/out/*.apk
```

---

## ۸. چک‌لیست گوگل‌پلی

### ۸.۱ چرا اپ‌های WebView رد می‌شوند
دو سیاست اصلی:

1. **Webviews and Affiliate Spam** — اپی که سایتی را که مالکش نیستید wrap کند یا فقط ترافیک
   افیلییت بسازد، رد می‌شود.
2. **Minimum Functionality (4.3)** — اپی که فقط یک URL را نشان می‌دهد و هیچ ارزش افزوده‌ای
   نسبت به مرورگر ندارد، رد می‌شود. اجرای این سیاست از ۲۰۲۴ به بعد سخت‌گیرانه‌تر شده است.

### ۸.۲ کارهایی که باید انجام دهید (فنی)
- [x] **مالک سایت باشید** یا اجازه‌ی کتبی داشته باشید؛ مدرک (WHOIS/DNS TXT) را آماده نگه دارید.
- [x] فقط **HTTPS**؛ `allow_mixed_content=false` و `usesCleartextTraffic=false` (پیش‌فرض همین است).
- [x] **AAB** برای اپ جدید (`--format aab`)؛ APK فقط برای تست و توزیع مستقیم.
- [x] **target API 35** یا بالاتر (از ۳۱ آگوست ۲۰۲۵ اجباری شد؛ برای موج بعدی، ۳۶ را در نظر بگیرید).
- [x] **قابلیت‌های نیتیو** را روشن بگذارید: نوتیفیکیشن، اشتراک‌گذاری نیتیو، دانلود با DownloadManager،
      آپلود فایل، pull-to-refresh، اسپلش، هپتیک — همه در همین پروژه هست.
- [x] **صفحه‌ی آفلاین** به‌جای صفحه‌ی سفید یا ارور کروم (`features.offline_page`).
- [x] **حالت آفلاین کامل** با `content.mode = "local"` (قوی‌ترین دفاع در برابر 4.3:
      اپ بدون اینترنت هم کار می‌کند، یعنی صرفاً مرورگر نیست).
- [x] **کمترین مجوز ممکن**؛ دوربین/موقعیت را فقط اگر واقعاً استفاده می‌کنید `true` کنید.
- [x] بدون کرش/صفحه‌ی سفید: قبل از ارسال روی چند دستگاه و اندروید ۸ تا ۱۵ تست کنید.
- [x] رابط کاربری واقعاً موبایلی و ریسپانسیو (اندازه‌ی دکمه‌ها حداقل 48dp).

### ۸.۳ کارهایی که باید انجام دهید (اداری)
- **Privacy Policy** با URL معتبر و در دسترس (اجباری).
- فرم **Data Safety** را دقیقاً مطابق واقعیت پر کنید (کوکی/آنالیتیکس/کرش‌لاگ را ذکر کنید).
- احراز هویت توسعه‌دهنده (کارت شناسایی) را کامل کنید.
- اگر حساب **شخصی** بعد از ۱۳ نوامبر ۲۰۲۳ ساخته‌اید: باید **۱۲ تستر برای ۱۴ روز پیوسته**
  در Closed Testing داشته باشید تا اجازه‌ی Production بگیرید (قبلاً ۲۰ نفر بود). حساب‌های
  Organization از این قانون مستثنا هستند. ۱۵ تا ۲۰ نفر دعوت کنید تا ریزش، شمارش را ریست نکند.
- در توضیحات اپ، «ارزش افزوده»های نیتیو را بنویسید (نوتیفیکیشن، کار آفلاین و …) —
  ریویوئر همان‌ها را چک می‌کند.

### ۸.۴ کارهایی که *نباید* بکنید
- wrap کردن سایت دیگران (آمازون، دیجی‌کالا، یوتیوب و …) → بن دائم اکانت.
- اپ‌های افیلییت/کوپن که فقط لینک باز می‌کنند.
- چند اپ تقریباً یکسان با نام‌های مختلف (Repetitive Content).
- تبلیغات full-screen غیرقابل بستن یا در لحظه‌ی باز شدن اپ.
- مخفی کردن اینکه محتوا وب است، یا استفاده از نام/لوگوی برند دیگران.
- درخواست مجوزهایی که استفاده نمی‌کنید (مخصوصاً `QUERY_ALL_PACKAGES`، SMS، Call Log).
- اپ‌های WebView در دسته‌ی **Families/Kids** — آنجا حتی با مالکیت سایت هم رد می‌شود.

### ۸.۵ اگر رد شدید
۱) متن دقیق دلیل رد را بخوانید (کد سیاست).
۲) اگر «Webview/Affiliate Spam» است → مدرک مالکیت دامنه را در Appeal بفرستید.
۳) اگر «Minimum Functionality» است → یک یا دو قابلیت نیتیو واقعی اضافه کنید
   (نوتیفیکیشن، حالت آفلاین، ورود بیومتریک، اشتراک‌گذاری) و `version_code` را بالا برده و دوباره بفرستید.
جریمه‌ای برای ارسال مجدد وجود ندارد، ولی رد شدن‌های پیاپی روی اعتبار حساب اثر می‌گذارد.

> **جایگزین رسمی گوگل:** اگر سایت شما PWA معتبر است (manifest + service worker + HTTPS)،
> بسته‌بندی با **TWA** (Trusted Web Activity) + فایل `assetlinks.json` روی دامنه، امن‌ترین
> مسیر عبور از سیاست 4.3 است؛ چون Digital Asset Links خودش اثبات مالکیت است.
> این پروژه عمداً WebView کلاسیک را انتخاب کرده چون کنترل کامل روی فول‌اسکرین،
> حالت آفلاین و پل نیتیو می‌دهد — چیزی که TWA نمی‌دهد.

---

## ۹. عیب‌یابی

| مشکل | راه‌حل |
|---|---|
| `Unsupported class file major version` | JDK 17 نصب و `JAVA_HOME` را به آن ست کنید |
| `SDK location not found` | `python3 build_apk.py sdk` یا `ANDROID_HOME` را ست کنید |
| دانلود gradle-wrapper.jar شکست خورد | `cd build/android-project && gradle wrapper` یا پروژه را در Android Studio باز کنید |
| صفحه‌ی سفید در حالت local | مطمئن شوید `index.html` در ریشه‌ی `local_web_dir` است و مسیرها **نسبی** باشند (`./app.js` نه `/app.js`) |
| دیباگ محتوای وب | `webview.debug_webview = true` و در کروم دسکتاپ: `chrome://inspect` |
| لاگ زنده | `adb logcat | grep -i chromium` |
| فونت فارسی دیده نمی‌شود | فونت را base64 یا داخل assets بگذارید (اپ آفلاین به فونت CDN دسترسی ندارد) |
| ویدیو پخش نمی‌شود | `media_autoplay=true` و برای تمام‌صفحه شدن ویدیو، از `<video playsinline>` استفاده کنید |

---

## ساختار پوشه

```
webview-apk/
├── build_apk.py        # بیلدر اصلی (پایتون)
├── serve.py            # پیش‌نمایش محلی محتوا
├── config.json         # همه‌ی تنظیمات
├── templates/          # قالب‌های Java/Gradle/XML
└── build/
    ├── android-project/  # پروژه‌ی تولیدشده (قابل باز کردن در Android Studio)
    └── out/              # APK/AAB نهایی
```
