# پروژه اندروید آرموکس 📱

`targetSdk 32` ✅ | `compileSdk 32` | `minSdk 21` (اندروید ۵ به بالا)

کل وب‌اپ آرموکس (HTML/CSS/JS) داخل `app/src/main/assets/www` قرار دارد و با WebView اجرا می‌شود.
localStorage اپ فعال است، انتخاب عکس از گالری هم پیاده‌سازی شده.

## ساخت APK (حدود ۵ دقیقه)

1. **Android Studio** را نصب کن (نسخه Electric Eel یا جدیدتر).
2. `File → Open` و پوشه **`android`** همین ریپو را باز کن (همین پوشه، نه ریشه ریپو).
3. صبر کن **Gradle Sync** تمام شود — اولین بار Gradle 7.4 و پلاگین اندروید 7.2.2 را خودکار دانلود می‌کند (اینترنت لازم است).
   - اگر درباره Gradle Wrapper خطا داد: در ترمینال اندروید استودیو بزن `gradle wrapper --gradle-version 7.4`
     یا `Settings → Build, Execution → Gradle → Use Gradle from: Specified location`.
4. `Build → Build Bundle(s)/APK(s) → Build APK(s)`
5. خروجی: `app/build/outputs/apk/debug/app-debug.apk`

## نسخهٔ Release برای انتشار در مایکت/بازار

`Build → Generate Signed Bundle/APK → APK` → کلید keystore بساز (و جای امنی نگهش دار) → **Release**.

حجم APK نهایی حدود **۳ تا ۳/۵ مگابایت** است (زیر ۵ مگ ✅).

## تغییر targetSdk در آینده

فقط همین خط در `app/build.gradle`:

```gradle
targetSdk 32
```

اگر مایکت/بازار روزی عدد بالاتری خواستند، همان عدد را بگذار و `compileSdk` را هم برابرش کن.
(مایکت فعلاً حداقل ۲۸ می‌خواهد؛ ۳۲ مشکلی ندارد.)
