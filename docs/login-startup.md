# Launch at login (1.10.0)

Settings contains a persisted Launch at login switch (Chinese/English/Japanese/Korean). Windows and macOS packaged apps use Electron login-item registration. Unsupported platforms and unpackaged developer runs do not create startup entries; Linux switch is disabled. Demo/test runs never call native startup APIs.

The Windows registration has the stable name Quota Pebble, points to the running production executable, and supplies only --autostart. Each new packaged version refreshes that path when first run. Disabling removes this app's registration. --enable-autostart is a one-time local launch option used to apply the user's explicit request; it is not stored in the startup entry.

Validation covers stable name/current path, enable/disable, demo/test isolation, UI persistence across restart and four-language layout. Real Windows startup registration is inspected after enabling the production build; a physical reboot is not performed.

Windows verification found that openAtLogin reflects Electron's default registration name. The implementation therefore checks the enabled Quota Pebble entry in launchItems when using the stable custom name. A regression test covers this distinction. The production Run entry and saved autoStart preference were both verified enabled.
