# XM Toolkit

An Ingress toolkit PWA for Android and iOS. A collection of tools for Ingress players, themed around the Enlightened faction aesthetic.

## Features

### Portal Cooldown Timer
- Per-portal floating draggable bubbles with SVG ring progress
- 30s–300s duration presets in 10s steps
- Hack counter per portal (auto-increments on cooldown completion)
- Tap running timer to force-complete (counts as a hack)
- Tap completed timer to restart cooldown
- Optional system notifications via Service Worker (works in background on Android)
- Optional ntfy.sh push notifications — works in background on both iOS and Android
- Vibration + toast alerts when portal is ready
- Warning state (orange glow) at 10 seconds remaining
- Bubbles snap to screen edges and persist positions
- Timer state persists across sessions via localStorage

### Portal Range Calculator
- Configure 8 resonator levels and up to 4 link amps
- Real-time km range display using Ingress link range formula (`160 * avgLevel^4`)
- Link Amp types: RLA (x2), SBUL (x5), VRLA (x7) with diminishing returns stacking
- Color-coded resonator sprites and level numbers using Ingress level palette (L1 yellow → L8 purple)
- Amp slots color-coded by type (cyan/orange/green) with swappable sprites
- Default solo L8 deploy preset (8/7/6/6/5/5/4/4)
- Tap-to-select slots with mutually exclusive pickers

### Drone Hack Reminder
- Single-timer drone hack cooldown tracker (one drone per player)
- Visual states: Cooling Down (cyan), Ready (green), Overdue (orange pulsing)
- SVG ring progress indicator with countdown
- Lifetime hack counter and relative "last hack" time
- Configurable cooldown (default 60 min), idle threshold (default 4h), idle repeat (default 8h)
- Notifications: SW "ready" alert + ntfy.sh ready + up to 3 idle reminders (server-side scheduled)
- State persists across sessions via localStorage

### Settings
- System notifications toggle (SW-based, opt-in)
- ntfy.sh push notifications — configure server URL, topic, and optional access token for self-hosted servers. Test button, works cross-platform in background
- Auto-generated random topic for privacy
- Drone reminder timing configuration (cooldown, idle alert, idle repeat)

### Coming Soon
- **Portal Upgrade VRBB Helper** — Portal upgrade & VRBB planning

## Install

### iPhone (iOS)
1. Open the app URL in **Safari**
2. Tap the **Share** button → **Add to Home Screen** → **Add**

### Android
1. Open in **Chrome**
2. Tap the **INSTALL** banner at the bottom, or use **⋮** → **Add to Home Screen**
3. For notification banners: Settings → Apps → XM Toolkit → Notifications → Categories → General → enable **Banner**

## Development

No build step required. The app is pure vanilla HTML/CSS/JS.

```bash
# Start a local dev server (PHP)
php -S localhost:8080

# Or use Python
python3 -m http.server 8080

# Or use npx
npx serve .
```

The service worker uses network-first strategy on localhost, so file changes are reflected immediately on reload.

### Versioning

The app version is defined in `env.js` as `APP_VERSION`. This single value controls:
- The SW cache name (auto-busts cache on version change)
- The version tag displayed on the dashboard

To release an update, bump the version in `env.js`:
```js
const APP_VERSION = '3.4.0';
```

## Project Structure

```
xm-toolkit/
├── index.html          # Single-page app shell (all screens)
├── env.js              # App version (single source of truth)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline + background notifications)
├── CLAUDE.md           # AI assistant project context
├── css/
│   └── style.css       # All styles
├── js/
│   └── app.js          # App logic (navigation, timers, PWA)
└── assets/
    ├── icons/
    │   ├── icon-192.png    # Android / favicon
    │   └── icon-512.png    # Android splash / maskable
    └── sprites/
        ├── resonator.png   # Resonator sprite (CSS mask tinted)
        ├── linkamp.png     # Link amp sprite (RLA/VRLA)
        └── ultralink.png   # Ultra link sprite (SBUL)
```

## Tech Stack

- **HTML/CSS/JS** — No frameworks, no dependencies, no build step
- **Google Fonts** — Orbitron (display) + Share Tech Mono (body)
- **Service Worker** — Offline-first caching with dev/prod strategies
- **PWA APIs** — Wake Lock, Vibration, Notifications, beforeinstallprompt
- **Pointer Events** — Unified mouse + touch drag handling

## Design

The UI follows the Ingress Enlightened faction aesthetic:
- Cyan (`#00e5ff`) primary color with dark near-black background
- Orbitron font with wide letter-spacing for a HUD feel
- Animated grid background and scanline overlay
- Pulsing glow effects on timer bubbles
- Glassmorphism on navigation bar and install banner
