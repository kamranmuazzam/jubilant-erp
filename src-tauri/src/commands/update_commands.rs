use crate::error::{AppError, AppResult};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

#[derive(Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: u32,
    pub status: String,
}

#[tauri::command]
pub async fn download_android_apk(
    apk_url: String,
    app_handle: tauri::AppHandle,
) -> AppResult<String> {
    let client = reqwest::Client::builder()
        .user_agent("JubilantERP-Updater")
        .build()
        .map_err(|e| AppError::new("HTTP_ERROR", e.to_string()))?;

    let response = client
        .get(&apk_url)
        .send()
        .await
        .map_err(|e| AppError::new("HTTP_ERROR", format!("Failed to fetch APK: {}", e)))?;

    let total_bytes = response.content_length().unwrap_or(0);

    let cache_dir: PathBuf = tauri::Manager::path(&app_handle)
        .app_cache_dir()
        .or_else(|_| tauri::Manager::path(&app_handle).app_data_dir())
        .unwrap_or_else(|_| PathBuf::from("."));

    std::fs::create_dir_all(&cache_dir).map_err(|e| AppError::new("FS_ERROR", e.to_string()))?;
    let target_path = cache_dir.join("update.apk");

    let mut file = tokio::fs::File::create(&target_path)
        .await
        .map_err(|e| AppError::new("FS_ERROR", format!("Failed to create APK file: {}", e)))?;

    let mut stream = response.bytes_stream();
    let mut downloaded_bytes: u64 = 0;
    let mut last_pct: u32 = 0;

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| AppError::new("NETWORK_ERROR", e.to_string()))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| AppError::new("DISK_ERROR", e.to_string()))?;

        downloaded_bytes += chunk.len() as u64;

        let pct = if total_bytes > 0 {
            ((downloaded_bytes as f64 / total_bytes as f64) * 100.0).round() as u32
        } else {
            0
        };

        if pct != last_pct || downloaded_bytes == total_bytes {
            last_pct = pct;
            let _ = app_handle.emit(
                "tauri://download-progress",
                DownloadProgressPayload {
                    downloaded: downloaded_bytes,
                    total: total_bytes,
                    percentage: pct,
                    status: "downloading".to_string(),
                },
            );
        }
    }

    file.flush().await.map_err(|e| AppError::new("DISK_ERROR", e.to_string()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&target_path, std::fs::Permissions::from_mode(0o644));
    }

    let _ = app_handle.emit(
        "tauri://download-progress",
        DownloadProgressPayload {
            downloaded: downloaded_bytes,
            total: total_bytes,
            percentage: 100,
            status: "finished".to_string(),
        },
    );

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_install_permission(
    #[allow(unused_variables)] app_handle: tauri::AppHandle,
) -> AppResult<bool> {
    #[cfg(target_os = "android")]
    {
        // On Android, check PackageManager.canRequestPackageInstalls()
        let vm_ptr = ndk_context::android_context().vm();
        let ctx_ptr = ndk_context::android_context().context();
        let vm = unsafe { jni::JavaVM::from_raw(vm_ptr as *mut _) }
            .map_err(|e| AppError::new("JNI_ERROR", e.to_string()))?;
        let mut env = vm.attach_current_thread()
            .map_err(|e| AppError::new("JNI_ERROR", e.to_string()))?;
        let context = unsafe { jni::objects::JObject::from_raw(ctx_ptr as *mut _) };

        if let Ok(pm) = env.call_method(&context, "getPackageManager", "()Landroid/content/pm/PackageManager;", &[]) {
            if let Ok(pm_obj) = pm.l() {
                if let Ok(can_install) = env.call_method(&pm_obj, "canRequestPackageInstalls", "()Z", &[]) {
                    if let Ok(allowed) = can_install.z() {
                        return Ok(allowed);
                    }
                }
            }
        }
        Ok(true)
    }

    #[cfg(not(target_os = "android"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub async fn install_android_apk(
    file_path: String,
    #[allow(unused_variables)] app_handle: tauri::AppHandle,
) -> AppResult<bool> {
    #[cfg(target_os = "android")]
    {
        launch_android_apk_installer(&file_path)
            .map_err(|e| AppError::new("INSTALL_ERROR", format!("Failed to launch installer: {}", e)))?;
        Ok(true)
    }

    #[cfg(not(target_os = "android"))]
    {
        println!("install_android_apk called on desktop with file: {}", file_path);
        Ok(true)
    }
}

#[cfg(target_os = "android")]
fn launch_android_apk_installer(file_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let vm_ptr = ndk_context::android_context().vm();
    let ctx_ptr = ndk_context::android_context().context();
    let vm = unsafe { jni::JavaVM::from_raw(vm_ptr as *mut _) }?;
    let mut env = vm.attach_current_thread()?;
    let context = unsafe { jni::objects::JObject::from_raw(ctx_ptr as *mut _) };

    // 1. Relax StrictMode to allow file:// URI sharing without FileUriExposedException
    if let Ok(strict_mode) = env.find_class("android/os/StrictMode") {
        if let Ok(builder_class) = env.find_class("android/os/StrictMode$VmPolicy$Builder") {
            if let Ok(builder) = env.new_object(builder_class, "()V", &[]) {
                if let Ok(policy) = env.call_method(&builder, "build", "()Landroid/os/StrictMode$VmPolicy;", &[]) {
                    if let Ok(policy_obj) = policy.l() {
                        let _ = env.call_static_method(
                            strict_mode,
                            "setVmPolicy",
                            "(Landroid/os/StrictMode$VmPolicy;)V",
                            &[(&policy_obj).into()],
                        );
                    }
                }
            }
        }
    }

    // 2. Create File and Uri
    let file_class = env.find_class("java/io/File")?;
    let path_jstr = env.new_string(file_path)?;
    let file_obj = env.new_object(file_class, "(Ljava/lang/String;)V", &[(&path_jstr).into()])?;

    let uri_class = env.find_class("android/net/Uri")?;
    let uri_obj = env.call_static_method(
        uri_class,
        "fromFile",
        "(Ljava/io/File;)Landroid/net/Uri;",
        &[(&file_obj).into()],
    )?.l()?;

    // 3. Create Intent(Intent.ACTION_VIEW)
    let intent_class = env.find_class("android/content/Intent")?;
    let action_view_str = env.new_string("android.intent.action.VIEW")?;
    let intent_obj = env.new_object(
        intent_class,
        "(Ljava/lang/String;)V",
        &[(&action_view_str).into()],
    )?;

    // 4. Set MIME type
    let mime_type = env.new_string("application/vnd.android.package-archive")?;
    env.call_method(
        &intent_obj,
        "setDataAndType",
        "(Landroid/net/Uri;Ljava/lang/String;)Landroid/content/Intent;",
        &[(&uri_obj).into(), (&mime_type).into()],
    )?;

    // 5. Add Intent Flags (FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION)
    let flags: i32 = 0x10000000 | 0x00000001;
    env.call_method(
        &intent_obj,
        "addFlags",
        "(I)Landroid/content/Intent;",
        &[flags.into()],
    )?;

    // 6. Launch Activity
    env.call_method(
        context,
        "startActivity",
        "(Landroid/content/Intent;)V",
        &[(&intent_obj).into()],
    )?;

    Ok(())
}
