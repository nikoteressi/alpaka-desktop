# System Integration

## System Tray

Alpaka Desktop runs in the system tray when minimised. The tray icon gives you quick access to:
- Open / show the main window
- Quit

The tray icon works with KDE Plasma (SNI protocol), GNOME (via AppIndicator extension), and Hyprland / other compositors that support the StatusNotifierItem protocol.

## Desktop Notifications

Alpaka Desktop sends desktop notifications via D-Bus (`org.freedesktop.Notifications`) for various background events, including:
- Model pull complete
- Custom model creation complete
- Background task completion
- Generation or connection errors

Notifications appear in your desktop notification centre (KDE, GNOME, dunst, etc.).

## Ollama Service Control

If Ollama is installed as a systemd user service (the default for the official Linux installer), Alpaka Desktop will automatically restart the service when you change the models storage path in **Settings → Engine**.

If Ollama is installed as a system service (root), a `pkexec` policy kit prompt appears to authorise the restart action.

## Compact / TWM Mode

Designed for tiling window managers (Hyprland, Sway, i3, bspwm):

| Property | Standard | Compact |
|---|---|---|
| Sidebar | Visible (260px) | Hidden |
| Message padding | 16px | 8px |
| Top bar | Full controls | Model name + host dot only |
| Font sizes | 15px body | 13px body |
| Minimum usable width | ~500px | ~320px |

Toggle with `Ctrl+Shift+M` or via **Settings → Appearance → Compact Mode**.

## Dark / Light Mode

Alpaka Desktop defaults to dark mode and follows `prefers-color-scheme`. Toggle manually via the theme button in the top bar.
