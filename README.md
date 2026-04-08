# SSHTool

A modern desktop SSH client built with Electron, React, TypeScript, and Vite.

## Installation (macOS)

Currently, the application is not yet signed with an Apple Developer ID. If you download the release and move it to your `Applications` folder, macOS Gatekeeper might show a warning like: 
_"App is damaged and can't be opened. You should move it to the Trash."_

To bypass this security feature and allow the app to run, you need to remove the quarantine attributes using the Terminal.

### Steps to Install & Open

1. **Mount the DMG:** Double-click the downloaded `.dmg` file.
2. **Copy to Applications:** Drag and drop **SSHTool.app** into your **Applications** folder.
3. **Do not open the app yet.**
4. **Open Terminal:** Press `Cmd + Space`, type `Terminal`, and hit Enter.
5. **Run the bypass command:** Copy and paste the following command into your Terminal and hit Enter:
   ```bash
   sudo xattr -cr /Applications/SSHTool.app
   ```
   *(Note: You will be prompted to enter your Mac password. The characters won't appear while you type, just type your password and press Enter).*
6. **Open the App:** You can now launch SSHTool from your Applications folder normally!

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build the app and standalone DMG installer
npm run build
```
