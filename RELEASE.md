# SSHTool Release Notes

## Version 1.0.0

- **Initial Release:** A modern desktop SSH client.
- Support for multi-tab xterm.js SSH sessions, responsive terminal resizing, connection grouping, proxies, and robust connection lifecycle management.
- Added visual disconnected states and reconnection overlays.

---

### macOS Installation Notice (Developer ID Bypass)

Since this version is strictly built locally and has not been signed with an Apple Developer ID certificate, macOS Gatekeeper will block the application by default. You will see a warning stating: _"App is damaged and can't be opened. You should move it to the Trash."_

To install and open the app successfully, use the Terminal bypass workflow:

1. Double-click the `.dmg` installer and drag **SSHTool** into the **Applications** folder.
2. Open **Terminal** (Search via `Cmd + Space`).
3. Run the following command to remove quarantine flags:
   ```bash
   sudo xattr -cr /Applications/SSHTool.app
   ```
   *(Enter your local Mac password if sudo prompts you).*
4. You can now launch SSHTool from your Applications without any errors!
