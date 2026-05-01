#[cfg(not(feature = "test-mode"))]
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

#[cfg(not(feature = "test-mode"))]
pub fn setup(app: &AppHandle) -> Result<tauri::tray::TrayIcon, Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

    // Embed both light and dark icons
    let icon_white: &[u8] = include_bytes!("../../icons/32x32_dark.png");
    let icon_dark: &[u8] = include_bytes!("../../icons/32x32.png");

    // Get theme from the first available window
    let window_theme = app
        .webview_windows()
        .values()
        .next()
        .and_then(|w| w.theme().ok());

    // On Linux, panels are often dark even if apps are light.
    // Default to Dark theme (White icon) for better visibility.
    let is_light = window_theme
        .map(|t| t == tauri::Theme::Light)
        .unwrap_or(false);

    let initial_icon_bytes = if is_light { icon_dark } else { icon_white };
    let initial_icon = tauri::image::Image::from_bytes(initial_icon_bytes)?;

    let tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(initial_icon)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(tray)
}

#[cfg(not(feature = "test-mode"))]
pub fn update_icon(
    tray: &tauri::tray::TrayIcon,
    theme: tauri::Theme,
) -> Result<(), Box<dyn std::error::Error>> {
    let icon_white: &[u8] = include_bytes!("../../icons/32x32_dark.png");
    let icon_dark: &[u8] = include_bytes!("../../icons/32x32.png");

    // Theme::Light -> needs Dark icon
    // Theme::Dark -> needs White icon
    let icon_bytes = if theme == tauri::Theme::Light {
        icon_dark
    } else {
        icon_white
    };
    let icon = tauri::image::Image::from_bytes(icon_bytes)?;
    tray.set_icon(Some(icon))?;
    Ok(())
}
