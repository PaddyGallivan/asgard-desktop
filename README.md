# Asgard Desktop

Electron wrapper for [Asgard](https://asgard.pgallivan.workers.dev) — Luck Dragon internal tool.

## Setup

```bash
npm install
npm start
```

## Build

```bash
npm run dist:mac    # macOS DMG (universal)
npm run dist:win    # Windows NSIS installer
npm run dist:linux  # AppImage + deb
npm run dist:local  # local build, no publish
```

## Icons

| File | Size | Platform |
|------|------|----------|
| `assets/icon.png` | 512×512 | Linux / notifications |
| `assets/icon.ico` | 256px (embedded PNG) | Windows |
| `assets/icon-tray.png` | 32×32 | macOS/Linux tray |
| `assets/icon.icns` | multi-size | macOS — generate from icon.png |

To generate `icon.icns` on macOS:
```bash
mkdir icon.iconset
for s in 16 32 64 128 256 512; do sips -z $s $s assets/icon.png --out icon.iconset/icon_${s}x${s}.png; done
iconutil -c icns icon.iconset -o assets/icon.icns && rm -rf icon.iconset
```

## Auto-updates

Published releases via electron-builder + GitHub releases. Updater checks on launch and every 4 hours.
