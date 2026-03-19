mod fcm;

#[cfg(desktop)]
use tauri::{
    image::Image,
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager,
};
#[cfg(all(desktop, any(target_os = "windows", target_os = "linux", target_os = "macos")))]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg(desktop)]
fn app_icon() -> tauri::Result<Image<'static>> {
    Image::from_bytes(include_bytes!("../icons/icon.png")).map(|icon| icon.to_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fcm::get_platform,
            fcm::get_device_name,
            fcm::has_notification_permission,
            fcm::get_fcm_token,
            fcm::is_push_supported,
            fcm::get_pending_navigation,
            fcm::clear_pending_navigation,
        ]);

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(all(
                desktop,
                debug_assertions,
                any(target_os = "windows", target_os = "linux", target_os = "macos")
            ))]
            {
                app.deep_link().register_all()?;
            }

            // Create system tray icon (desktop only)
            #[cfg(desktop)]
            {
                let app_icon = app_icon()?;

                if let Some(window) = app.get_webview_window("main") {
                    window.set_icon(app_icon.clone())?;
                }

                let _tray = TrayIconBuilder::new()
                    .icon(app_icon)
                    .tooltip("Hush Feeds")
                    .on_tray_icon_event(|tray, event| {
                        // Show/focus main window on tray click
                        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
