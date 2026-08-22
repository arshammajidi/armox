#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Armox WebView APK Builder
=========================
ساخت اپ WebView اندروید (APK/AAB) فقط با پایتون + یک فایل config.json

دستورها:
    python3 build_apk.py doctor            # بررسی پیش‌نیازها (Java / Android SDK)
    python3 build_apk.py sdk               # دانلود و نصب خودکار Android SDK
    python3 build_apk.py keystore          # ساخت کلید امضای ریلیز
    python3 build_apk.py generate          # فقط ساخت سورس پروژه اندروید
    python3 build_apk.py build             # ساخت APK/AAB ریلیز
    python3 build_apk.py build --debug     # ساخت APK دیباگ (برای تست سریع)
    python3 build_apk.py clean

نیازمندی: Python 3.8+ ، JDK 17 ، اینترنت برای بار اول (Gradle + SDK).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import stat
import struct
import subprocess
import sys
import urllib.request
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATES = ROOT / "templates"

GRADLE_VERSION = "8.9"
WRAPPER_JAR_URL = (
    "https://raw.githubusercontent.com/gradle/gradle/v{v}.0/gradle/wrapper/gradle-wrapper.jar"
).format(v=GRADLE_VERSION)
CMDLINE_TOOLS_URL = (
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
)
BUILD_TOOLS = "35.0.0"

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


# --------------------------------------------------------------------------
# ابزارهای عمومی
# --------------------------------------------------------------------------
def log(msg: str) -> None:
    print(f"\033[36m›\033[0m {msg}")


def ok(msg: str) -> None:
    print(f"\033[32m✔\033[0m {msg}")


def warn(msg: str) -> None:
    print(f"\033[33m!\033[0m {msg}")


def die(msg: str) -> None:
    print(f"\033[31m✘ {msg}\033[0m")
    sys.exit(1)


def run(cmd, cwd=None, env=None, check=True):
    log(" ".join(str(c) for c in cmd))
    proc = subprocess.run(cmd, cwd=cwd, env=env)
    if check and proc.returncode != 0:
        die(f"دستور با خطا تمام شد (exit={proc.returncode})")
    return proc.returncode


def load_config(path: Path) -> dict:
    if not path.exists():
        die(f"فایل کانفیگ پیدا نشد: {path}")
    with path.open(encoding="utf-8") as f:
        cfg = json.load(f)
    validate(cfg)
    return cfg


def validate(cfg: dict) -> None:
    pkg = cfg["app"]["package_id"]
    if not re.fullmatch(r"[a-z][a-z0-9_]*(\.[a-z0-9_]+)+", pkg):
        die("package_id باید مثل com.company.app باشد (حروف کوچک، حداقل دو بخش).")
    if cfg["content"]["mode"] not in ("local", "remote"):
        die("content.mode باید local یا remote باشد.")
    if cfg["content"]["mode"] == "remote":
        url = cfg["content"]["start_url"]
        if not url.startswith("https://"):
            die("برای انتشار در گوگل‌پلی start_url باید https باشد.")


def jbool(v) -> str:
    return "true" if v else "false"


def render(name: str, subs: dict) -> str:
    text = (TEMPLATES / name).read_text(encoding="utf-8")
    for k, v in subs.items():
        text = text.replace("{{%s}}" % k, str(v))
    left = re.findall(r"\{\{([A-Z_]+)\}\}", text)
    if left:
        die(f"placeholder جایگزین‌نشده در {name}: {set(left)}")
    return text


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# --------------------------------------------------------------------------
# ساخت آیکون (بدون وابستگی خارجی؛ اگر Pillow نصب باشد کیفیت بهتر است)
# --------------------------------------------------------------------------
def solid_png(size: int, hex_color: str) -> bytes:
    r, g, b = (int(hex_color.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    raw = b"".join(b"\x00" + bytes([r, g, b, 255]) * size for _ in range(size))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def make_icons(res_dir: Path, icon_src: str, bg_color: str) -> None:
    src = Path(icon_src).expanduser() if icon_src else None
    if src and not src.is_absolute():
        src = (ROOT / src).resolve()

    pil = None
    if src and src.exists():
        try:
            from PIL import Image  # type: ignore
            pil = Image
        except ImportError:
            warn("Pillow نصب نیست؛ آیکون بدون تغییر اندازه کپی می‌شود (pip install pillow).")

    for density, size in DENSITIES.items():
        out_dir = res_dir / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)
        for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
            target = out_dir / name
            if src and src.exists() and pil:
                img = pil.open(src).convert("RGBA").resize((size, size), pil.LANCZOS)
                img.save(target)
            elif src and src.exists():
                shutil.copyfile(src, target)
            else:
                target.write_bytes(solid_png(size, bg_color))

    anydpi = res_dir / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    adaptive = ("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
                "<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">\n"
                "    <background android:drawable=\"@color/app_background\" />\n"
                "    <foreground android:drawable=\"@mipmap/ic_launcher_foreground\" />\n"
                "    <monochrome android:drawable=\"@mipmap/ic_launcher_foreground\" />\n"
                "</adaptive-icon>\n")
    (anydpi / "ic_launcher.xml").write_text(adaptive, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(adaptive, encoding="utf-8")


# --------------------------------------------------------------------------
# تولید پروژه اندروید
# --------------------------------------------------------------------------
CACHE_MODES = {
    "default": "WebSettings.LOAD_DEFAULT",
    "no_cache": "WebSettings.LOAD_NO_CACHE",
    "cache_first": "WebSettings.LOAD_CACHE_ELSE_NETWORK",
    "cache_only": "WebSettings.LOAD_CACHE_ONLY",
}
NIGHT_MODES = {
    "system": "AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM",
    "dark": "AppCompatDelegate.MODE_NIGHT_YES",
    "light": "AppCompatDelegate.MODE_NIGHT_NO",
}
ORIENTATIONS = {"portrait": "portrait", "landscape": "landscape",
                "sensor": "fullSensor", "auto": "fullUser"}


def permissions_xml(cfg: dict) -> str:
    p = cfg["permissions"]
    lines = []
    add = lines.append
    if p.get("internet", True):
        add('    <uses-permission android:name="android.permission.INTERNET" />')
        add('    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />')
    if p.get("notifications"):
        add('    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />')
    if p.get("vibrate"):
        add('    <uses-permission android:name="android.permission.VIBRATE" />')
    if p.get("camera"):
        add('    <uses-permission android:name="android.permission.CAMERA" />')
        add('    <uses-feature android:name="android.hardware.camera" android:required="false" />')
    if p.get("microphone"):
        add('    <uses-permission android:name="android.permission.RECORD_AUDIO" />')
        add('    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />')
    if p.get("location"):
        add('    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />')
        add('    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />')
    if p.get("downloads"):
        add('    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"\n'
            '        android:maxSdkVersion="28" />')
    # مرورگر خارجی روی اندروید 11+
    add('    <queries>\n'
        '        <intent>\n'
        '            <action android:name="android.intent.action.VIEW" />\n'
        '            <data android:scheme="https" />\n'
        '        </intent>\n'
        '    </queries>')
    return "\n".join(lines)


def deep_links_xml(cfg: dict) -> str:
    hosts = cfg["features"].get("deep_link_hosts") or []
    if not hosts:
        return ""
    data = "\n".join(
        f'                <data android:scheme="https" android:host="{h}" />' for h in hosts)
    return ('            <intent-filter android:autoVerify="true">\n'
            '                <action android:name="android.intent.action.VIEW" />\n'
            '                <category android:name="android.intent.category.DEFAULT" />\n'
            '                <category android:name="android.intent.category.BROWSABLE" />\n'
            f'{data}\n'
            '            </intent-filter>')


def signing_blocks(cfg: dict, project: Path):
    s = cfg["signing"]
    if not s.get("enabled"):
        return "", "            signingConfig signingConfigs.debug"
    ks = Path(s["keystore_path"]).expanduser()
    if not ks.is_absolute():
        ks = (ROOT / ks).resolve()
    if not ks.exists():
        die(f"keystore پیدا نشد: {ks}\nابتدا: python3 build_apk.py keystore")
    block = f"""    signingConfigs {{
        release {{
            storeFile file("{ks.as_posix()}")
            storePassword "{s['keystore_password']}"
            keyAlias "{s['key_alias']}"
            keyPassword "{s['key_password']}"
            enableV1Signing true
            enableV2Signing true
            enableV3Signing true
            enableV4Signing true
        }}
    }}"""
    return block, "            signingConfig signingConfigs.release"


def generate(cfg: dict, project: Path) -> Path:
    app = cfg["app"]
    content = cfg["content"]
    fs = cfg["fullscreen"]
    th = cfg["theme"]
    wv = cfg["webview"]
    ft = cfg["features"]
    sdk = cfg["sdk"]

    pkg = app["package_id"]
    local = content["mode"] == "local"
    start_url = ("https://appassets.androidplatform.net/assets/www/index.html"
                 if local else content["start_url"])
    cleartext = jbool(wv.get("allow_mixed_content") and not local)

    if project.exists():
        shutil.rmtree(project)
    app_dir = project / "app"
    src = app_dir / "src" / "main"
    java_dir = src / "java" / Path(*pkg.split("."))
    res = src / "res"

    sign_block, sign_use = signing_blocks(cfg, project)

    base = {
        "PACKAGE_ID": pkg,
        "APP_NAME": app["name"],
        "APP_NAME_SAFE": re.sub(r"[^A-Za-z0-9_]", "", pkg.split(".")[-1]) or "app",
        "VERSION_NAME": app["version_name"],
        "VERSION_CODE": app["version_code"],
        "MIN_SDK": sdk["min_sdk"],
        "TARGET_SDK": sdk["target_sdk"],
        "COMPILE_SDK": sdk["compile_sdk"],
        "MINIFY": jbool(cfg["build"].get("minify", True)),
        "SIGNING_BLOCK": sign_block,
        "SIGNING_USE": sign_use,
        "CLEARTEXT": cleartext,
        "ORIENTATION": ORIENTATIONS.get(fs.get("orientation", "portrait"), "portrait"),
        "PERMISSIONS": permissions_xml(cfg),
        "DEEP_LINKS": deep_links_xml(cfg),
        "OFFLINE_MESSAGE": content.get("offline_message", "No connection"),
        "OFFLINE_BUTTON": content.get("offline_button", "Retry"),
        "EXIT_CONFIRM_TEXT": ft.get("exit_confirm_text", "Press back again to exit"),
        "PRIMARY_COLOR": th["primary_color"],
        "BACKGROUND_COLOR": th["background_color"],
        "STATUS_BAR_COLOR": th["status_bar_color"],
        "NAV_BAR_COLOR": th["navigation_bar_color"],
        "SPLASH_BACKGROUND": th["splash_background"],
        "LIGHT_STATUS_ICONS": jbool(th.get("light_status_bar_icons")),
        "SPLASH_DURATION": ft.get("splash_duration_ms", 500),
        "NIGHT_MODE": NIGHT_MODES.get(th.get("dark_mode", "system")),
        "LOCAL_NOTIFICATIONS": jbool(ft.get("local_notifications", True)),
        "BRIDGE_NAME": ft.get("bridge_name", "Armox"),
        # webview
        "FULLSCREEN": jbool(fs.get("enabled", True)),
        "HIDE_STATUS_BAR": jbool(fs.get("hide_status_bar", True)),
        "HIDE_NAV_BAR": jbool(fs.get("hide_navigation_bar", True)),
        "EDGE_TO_EDGE": jbool(fs.get("edge_to_edge", True)),
        "KEEP_SCREEN_ON": jbool(fs.get("keep_screen_on", False)),
        "LOCAL_MODE": jbool(local),
        "START_URL": start_url,
        "ALLOWED_HOSTS": ", ".join(f'"{h}"' for h in content.get("allowed_hosts", [])),
        "PULL_TO_REFRESH": jbool(wv.get("pull_to_refresh", True)),
        "EXTERNAL_IN_BROWSER": jbool(wv.get("open_external_links_in_browser", True)),
        "FILE_UPLOAD": jbool(wv.get("file_upload", True)),
        "DOWNLOADS": jbool(wv.get("downloads", True)),
        "GEOLOCATION": jbool(wv.get("geolocation", False)),
        "CAMERA_MIC": jbool(wv.get("camera_microphone", False)),
        "JS_BRIDGE": jbool(ft.get("js_bridge", True)),
        "OFFLINE_PAGE": jbool(ft.get("offline_page", True)),
        "BACK_HISTORY": jbool(ft.get("back_navigates_history", True)),
        "EXIT_CONFIRM": jbool(ft.get("exit_confirm", True)),
        "LONG_PRESS_MENU": jbool(wv.get("long_press_menu", False)),
        "DEBUG_WEBVIEW": jbool(wv.get("debug_webview", False)),
        "JAVASCRIPT": jbool(wv.get("javascript", True)),
        "DOM_STORAGE": jbool(wv.get("dom_storage", True)),
        "DATABASE": jbool(wv.get("database", True)),
        "ZOOM": jbool(wv.get("zoom", False)),
        "TEXT_ZOOM": wv.get("text_zoom", 100),
        "MEDIA_AUTOPLAY": jbool(wv.get("media_autoplay", True)),
        "CACHE_MODE": CACHE_MODES.get(wv.get("cache_mode", "default"), CACHE_MODES["default"]),
        "MIXED_CONTENT": ("WebSettings.MIXED_CONTENT_ALWAYS_ALLOW"
                          if wv.get("allow_mixed_content")
                          else "WebSettings.MIXED_CONTENT_NEVER_ALLOW"),
        "UA_SUFFIX": wv.get("user_agent_suffix", ""),
        "DESKTOP_MODE": jbool(wv.get("desktop_mode", False)),
        "THIRD_PARTY_COOKIES": jbool(wv.get("third_party_cookies", True)),
        "SAFE_BROWSING": jbool(wv.get("safe_browsing", True)),
    }

    files = {
        "settings.gradle": project / "settings.gradle",
        "build.gradle": project / "build.gradle",
        "gradle.properties": project / "gradle.properties",
        "app-build.gradle": app_dir / "build.gradle",
        "proguard-rules.pro": app_dir / "proguard-rules.pro",
        "AndroidManifest.xml": src / "AndroidManifest.xml",
        "MainActivity.java": java_dir / "MainActivity.java",
        "NativeBridge.java": java_dir / "NativeBridge.java",
        "NetUtil.java": java_dir / "NetUtil.java",
        "App.java": java_dir / "App.java",
        "activity_main.xml": res / "layout" / "activity_main.xml",
        "strings.xml": res / "values" / "strings.xml",
        "colors.xml": res / "values" / "colors.xml",
        "themes.xml": res / "values" / "themes.xml",
        "network_security_config.xml": res / "xml" / "network_security_config.xml",
        "file_paths.xml": res / "xml" / "file_paths.xml",
        "backup_rules.xml": res / "xml" / "backup_rules.xml",
        "data_extraction_rules.xml": res / "xml" / "data_extraction_rules.xml",
    }
    for tpl, dest in files.items():
        write(dest, render(tpl, base))

    make_icons(res, app.get("icon", ""), th["background_color"])

    # محتوای وب آفلاین
    if local:
        web_src = Path(content["local_web_dir"]).expanduser()
        if not web_src.is_absolute():
            web_src = (ROOT / web_src).resolve()
        if not (web_src / "index.html").exists():
            die(f"index.html در {web_src} پیدا نشد.")
        dest = src / "assets" / "www"
        dest.mkdir(parents=True, exist_ok=True)
        copied = 0
        for item in web_src.rglob("*"):
            if any(part in {".git", "node_modules", "build", "webview-apk", "__pycache__"}
                   for part in item.relative_to(web_src).parts):
                continue
            if item.suffix.lower() in {".md", ".py", ".gitignore"}:
                continue
            if item.is_file():
                target = dest / item.relative_to(web_src)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(item, target)
                copied += 1
        ok(f"{copied} فایل وب داخل assets/www کپی شد (اپ کاملاً آفلاین کار می‌کند).")

    setup_wrapper(project)
    ok(f"پروژه اندروید ساخته شد: {project}")
    return project


def setup_wrapper(project: Path) -> None:
    wdir = project / "gradle" / "wrapper"
    wdir.mkdir(parents=True, exist_ok=True)
    (wdir / "gradle-wrapper.properties").write_text(
        "distributionBase=GRADLE_USER_HOME\n"
        "distributionPath=wrapper/dists\n"
        f"distributionUrl=https\\://services.gradle.org/distributions/gradle-{GRADLE_VERSION}-bin.zip\n"
        "zipStoreBase=GRADLE_USER_HOME\n"
        "zipStorePath=wrapper/dists\n", encoding="utf-8")

    cache = ROOT / "build" / "gradle-wrapper.jar"
    jar = wdir / "gradle-wrapper.jar"
    if cache.exists():
        shutil.copyfile(cache, jar)
    else:
        try:
            log("دانلود gradle-wrapper.jar ...")
            cache.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(WRAPPER_JAR_URL, cache)
            shutil.copyfile(cache, jar)
        except Exception as e:  # noqa: BLE001
            warn(f"دانلود wrapper ناموفق بود ({e}). اگر gradle نصب است اجرا کنید: "
                 f"cd {project} && gradle wrapper")
            return

    gradlew = project / "gradlew"
    gradlew.write_text(GRADLEW_SH, encoding="utf-8")
    gradlew.chmod(gradlew.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


GRADLEW_SH = """#!/bin/sh
DIR=$(cd "$(dirname "$0")" && pwd)
exec "${JAVA_HOME:+$JAVA_HOME/bin/}java" \\
    -classpath "$DIR/gradle/wrapper/gradle-wrapper.jar" \\
    org.gradle.wrapper.GradleWrapperMain "$@"
"""


# --------------------------------------------------------------------------
# محیط: Java / Android SDK
# --------------------------------------------------------------------------
def android_home() -> Path:
    for var in ("ANDROID_SDK_ROOT", "ANDROID_HOME"):
        v = os.environ.get(var)
        if v and Path(v).exists():
            return Path(v)
    default = Path.home() / "Android" / "Sdk"
    return default


def doctor() -> bool:
    good = True
    java = shutil.which("java")
    if java:
        out = subprocess.run(["java", "-version"], capture_output=True, text=True)
        ok(f"Java: {(out.stderr or out.stdout).splitlines()[0]}")
    else:
        warn("Java پیدا نشد. JDK 17 نصب کنید: apt install openjdk-17-jdk")
        good = False

    sdk = android_home()
    if (sdk / "platform-tools").exists() or (sdk / "platforms").exists():
        ok(f"Android SDK: {sdk}")
    else:
        warn(f"Android SDK نصب نیست ({sdk}). اجرا کنید: python3 build_apk.py sdk")
        good = False
    return good


def install_sdk(cfg: dict) -> None:
    sdk = android_home()
    sdk.mkdir(parents=True, exist_ok=True)
    tools = sdk / "cmdline-tools" / "latest"
    if not (tools / "bin" / "sdkmanager").exists():
        zip_path = sdk / "cmdline-tools.zip"
        log("دانلود Android command line tools ...")
        urllib.request.urlretrieve(CMDLINE_TOOLS_URL, zip_path)
        shutil.unpack_archive(str(zip_path), str(sdk / "_tmp"))
        tools.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(sdk / "_tmp" / "cmdline-tools"), str(tools))
        shutil.rmtree(sdk / "_tmp", ignore_errors=True)
        zip_path.unlink(missing_ok=True)
        for f in (tools / "bin").iterdir():
            f.chmod(f.stat().st_mode | stat.S_IEXEC)

    sm = tools / "bin" / "sdkmanager"
    api = cfg["sdk"]["compile_sdk"]
    subprocess.run(f'yes | "{sm}" --sdk_root="{sdk}" --licenses', shell=True)
    run([str(sm), f"--sdk_root={sdk}", "platform-tools",
         f"platforms;android-{api}", f"build-tools;{BUILD_TOOLS}"])
    ok(f"Android SDK آماده است: {sdk}")


def gradle_env(sdk_dir: Path) -> dict:
    env = os.environ.copy()
    env["ANDROID_SDK_ROOT"] = str(sdk_dir)
    env["ANDROID_HOME"] = str(sdk_dir)
    return env


# --------------------------------------------------------------------------
# keystore
# --------------------------------------------------------------------------
def make_keystore(cfg: dict) -> None:
    s = cfg["signing"]
    ks = Path(s["keystore_path"]).expanduser()
    if not ks.is_absolute():
        ks = (ROOT / ks).resolve()
    if ks.exists():
        die(f"از قبل وجود دارد: {ks} (این فایل را گم نکنید!)")
    if "CHANGE_ME" in (s["keystore_password"], s["key_password"]):
        die("ابتدا رمزهای بخش signing در config.json را عوض کنید.")
    keytool = shutil.which("keytool") or (
        str(Path(os.environ.get("JAVA_HOME", "")) / "bin" / "keytool"))
    run([keytool, "-genkeypair", "-v",
         "-keystore", str(ks), "-alias", s["key_alias"],
         "-keyalg", "RSA", "-keysize", "4096", "-validity", "10000",
         "-storepass", s["keystore_password"], "-keypass", s["key_password"],
         "-dname", s["dname"]])
    ok(f"keystore ساخته شد: {ks}\n  ⚠️ نسخه پشتیبان بگیرید؛ بدون آن نمی‌توانید آپدیت منتشر کنید.")


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------
def build(cfg: dict, project: Path, debug: bool, fmt: str) -> None:
    sdk = android_home()
    if not (sdk / "platforms").exists():
        die("Android SDK نصب نیست. اجرا کنید: python3 build_apk.py sdk")
    (project / "local.properties").write_text(
        f"sdk.dir={sdk.as_posix()}\n", encoding="utf-8")

    gradlew = project / "gradlew"
    if not gradlew.exists():
        die("gradlew ساخته نشد؛ اینترنت را بررسی کنید یا gradle را دستی نصب کنید.")

    if debug:
        task = "assembleDebug"
    else:
        task = "bundleRelease" if fmt == "aab" else "assembleRelease"

    run([str(gradlew), task, "--no-daemon"], cwd=project, env=gradle_env(sdk))

    out_dir = Path(cfg["build"]["output_dir"])
    if not out_dir.is_absolute():
        out_dir = (ROOT / out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    found = []
    for pattern in ("**/outputs/apk/**/*.apk", "**/outputs/bundle/**/*.aab"):
        for f in project.glob(pattern):
            dest = out_dir / f"{cfg['app']['version_name']}-{f.name}"
            shutil.copyfile(f, dest)
            found.append(dest)
    if not found:
        die("خروجی ساخته نشد.")
    for f in found:
        ok(f"خروجی: {f}  ({f.stat().st_size / 1_048_576:.1f} MB)")
    if not debug and not cfg["signing"].get("enabled"):
        warn("خروجی ریلیز با کلید دیباگ امضا شده و برای گوگل‌پلی قابل قبول نیست؛ "
             "signing.enabled را true کنید.")


# --------------------------------------------------------------------------
def main() -> None:
    p = argparse.ArgumentParser(description="Armox WebView APK builder")
    p.add_argument("command",
                   choices=["doctor", "sdk", "keystore", "generate", "build", "clean"])
    p.add_argument("--config", default=str(ROOT / "config.json"))
    p.add_argument("--debug", action="store_true", help="ساخت نسخه دیباگ")
    p.add_argument("--format", choices=["apk", "aab"], help="فرمت خروجی ریلیز")
    args = p.parse_args()

    if args.command == "doctor":
        sys.exit(0 if doctor() else 1)

    cfg = load_config(Path(args.config).expanduser().resolve())
    project = Path(cfg["build"]["project_dir"])
    if not project.is_absolute():
        project = (ROOT / project).resolve()

    if args.command == "sdk":
        install_sdk(cfg)
    elif args.command == "keystore":
        make_keystore(cfg)
    elif args.command == "generate":
        generate(cfg, project)
    elif args.command == "build":
        generate(cfg, project)
        build(cfg, project, args.debug, args.format or cfg["build"].get("format", "apk"))
    elif args.command == "clean":
        shutil.rmtree(ROOT / "build", ignore_errors=True)
        ok("پاک شد.")


if __name__ == "__main__":
    main()
