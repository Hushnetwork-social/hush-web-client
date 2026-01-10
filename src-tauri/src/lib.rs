mod fcm;

#[cfg(desktop)]
use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fcm::get_platform,
            fcm::get_device_name,
            fcm::has_notification_permission,
            fcm::get_fcm_token,
            fcm::is_push_supported,
            fcm::get_pending_navigation,
            fcm::clear_pending_navigation,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create system tray icon (desktop only)
            #[cfg(desktop)]
            {
                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
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
