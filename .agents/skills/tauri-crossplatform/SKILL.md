---
name: tauri-crossplatform
description: >-
  Use this skill when setting up, developing, building, or configuring Tauri v2 applications
  across macOS, Windows, and Android. Covers dual-engine auto-updating, capabilities isolation,
  bundled SQLite compilation, and GitHub Actions CI/CD release pipelines.
---

# Tauri Cross-Platform Build & Architecture Skill

This skill documents the exact workflow and conventions for maintaining and compiling a multi-platform Tauri v2 application targeting **macOS** (locally and CI), **Windows** (CI), and **Android** (CI sideloaded APK).

## 1. Dependency Scoping in Cargo.toml

Desktop-only plugins (like `tauri-plugin-updater`) must never be loaded on Android or iOS. Configure `src-tauri/Cargo.toml` as follows:

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
rusqlite = { version = "0.32", features = ["bundled"] }

[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2"

[target.'cfg(target_os = "android")'.dependencies]
jni = "0.21"
ndk-context = "0.1"
```

> **Why `rusqlite` with `bundled`?**
> The `bundled` feature compiles SQLite from source directly into the binary, meaning you do not need native SQLite dynamic libraries installed on macOS, Windows, or Android NDK.

---

## 2. Capabilities Separation

Create two distinct capabilities in `src-tauri/capabilities/`:

### `default.json` (Universal)
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "General application capabilities",
  "windows": ["main", "*"],
  "permissions": [
    "core:default"
  ]
}
```

### `desktop.json` (Desktop Only)
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "desktop-updater",
  "description": "Desktop auto-updater capability",
  "windows": ["main", "*"],
  "platforms": ["macOS", "windows", "linux"],
  "permissions": [
    "updater:default"
  ]
}
```

---

## 3. Dual-Engine Auto-Update Architecture

### A. Desktop (macOS & Windows)
Desktop targets use `tauri-plugin-updater`.
In `src-tauri/src/lib.rs`:
```rust
#[cfg(desktop)]
{
    builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
}
```

In `src-tauri/tauri.conf.json`:
```json
"plugins": {
  "updater": {
    "pubkey": "<MINISIGN_PUBLIC_KEY>",
    "endpoints": [
      "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
    ]
  }
}
```

### B. Mobile (Android)
Android cannot use `tauri-plugin-updater`. Instead, follow the pattern established in production plugins (`tauri-plugin-android-installer`):
1. SolidJS checks the latest release tag via GitHub Releases API.
2. Rust command `download_android_apk` streams the APK chunk-by-chunk to the app cache directory (`context.cacheDir`) and emits `tauri://download-progress`.
3. Rust command `check_install_permission` verifies `PackageManager.canRequestPackageInstalls()`. If missing, it directs the user to `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`.
4. Rust command `install_android_apk` invokes Android's package installer via JNI:
   - Uses `ndk_context::android_context()`
   - Converts the cache file path to a secure `content://` URI using `androidx.core.content.FileProvider.getUriForFile()`
   - Constructs `android.content.Intent(Intent.ACTION_VIEW)` with MIME type `application/vnd.android.package-archive`
   - Sets flags: `FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION`
   - This eliminates `FileUriExposedException` on Android 10–15+.

---

## 4. Local macOS Compilation Workflow

```bash
# 1. Install frontend dependencies
npm install

# 2. Run local development with live reload
npm run tauri dev

# 3. Compile local macOS release bundle (.dmg and .app)
npm run tauri build
```

---

## 5. GitHub Actions Multi-Platform Workflow Reference

A complete `.github/workflows/release.yml` uses a build matrix:
- `macos-latest`: Desktop target (produces `.dmg`, `.app`, and updater tarball).
- `windows-latest`: Desktop target (produces `.msi`, `.exe`, and updater zip).
- `ubuntu-latest`: Android target using Java 17, Android NDK `r26b`, and `r0adkll/sign-android-release@v1` to output a signed universal APK.
