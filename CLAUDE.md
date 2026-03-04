# XM Toolkit

## Project Overview

Ingress-themed Progressive Web App (PWA) — a multi-tool toolkit for Ingress players. Currently ships a portal hack cooldown tracker, with range calculator and VRBB helper planned.

**Zero dependencies.** Pure vanilla HTML/CSS/JS served as static files. No build step, no bundler, no package.json. Only external resource is Google Fonts CDN (Share Tech Mono + Orbitron).

## Architecture

### File Structure

```
index.html          → Single-page app shell, all screens defined here
env.js              → APP_VERSION constant (single source of truth for version)
css/style.css       → All styles (~460 lines)
js/app.js           → All logic (~330 lines)
sw.js               → Service worker (caching + background notification scheduling)
manifest.json       → PWA manifest (standalone, portrait-primary)
assets/icons/       → icon-192.png, icon-512.png
```

### Navigation

Screen-based routing via CSS class toggling — no router library, no History API.

- `SCREENS` object maps screen names to `{ el, title }` pairs
- `goTo(name)` removes `.active` from current screen, adds to target
- `.screen` default: `opacity: 0; transform: translateX(30px); pointer-events: none`
- `.screen.active`: `opacity: 1; transform: translateX(0); pointer-events: all`
- Tool cards use `data-screen` attribute to declare navigation target
- Back button always calls `goTo('home')`

To add a new screen: add HTML in `#screens`, register in the `SCREENS` object in app.js, add a tool card with `data-screen="screenName"`.

### State Management

- All timer state lives in `localStorage` under key `xm-timers3`
- Timer objects: `{ id, name, startedAt, duration, hacks }`
- `save()` serializes entire `timers` array on every mutation
- `bubbleMap` object maps timer IDs to their DOM elements
- `prevDoneIds` Set tracks completion edges to avoid re-firing alerts
- Single `setInterval(tick, 1000)` drives all timer UI updates
- `visibilitychange` triggers immediate `tick()` to catch up on completions when returning to app
- Notification scheduling delegated to SW via `postMessage` (see Service Worker section)

### Bubbles (Portal Timers)

- `position: fixed` — float above all screens at z-index 9000
- Draggable via Pointer Events API (`setPointerCapture` pattern)
- `_wasDragged` flag on DOM element disambiguates tap vs drag
- Auto-arrange in columns from right edge on spawn
- Snap to nearest screen edge on drag release
- Three visual states: running (cyan), warning <10s (orange), done (green)
- SVG ring uses `stroke-dashoffset` for progress animation

## Design System

### CSS Custom Properties

```css
--enl:     #00e5ff    /* Primary — ENL cyan */
--xm:      #00ff9d    /* Success — XM green */
--warn:    #ff6b00    /* Warning — orange */
--danger:  #ff1744    /* Destructive — red */
--bg:      #020d0f    /* Background — near-black */
--surface: rgba(0,229,255,0.04)   /* Card/surface fill */
--border:  rgba(0,229,255,0.18)   /* Card/surface border */
```

### Typography

- **Orbitron** (weights 400/700/900) — headings, labels, buttons, badge text. Geometric sci-fi display font.
- **Share Tech Mono** — body text, inputs, countdown numbers. Monospaced technical feel.
- Letter-spacing 1px–3px throughout for HUD aesthetic.

### Visual Patterns

- Grid background via `body::before` (40px cyan gridlines at 3% opacity)
- Centered radial glow via `body::after`
- Scanline animation (2px stripe, 4s loop)
- Glassmorphism on topbar and install banner (`backdrop-filter: blur(20px)`)
- Pulsing glow keyframes on bubbles: `pbGlow` (2s), `pbWarn` (0.7s), `pbDone` (0.5s)

### Z-Index Layers

| Layer | Z-Index |
|-------|---------|
| Body pseudo-elements (grid, glow) | 0 |
| Screen content | 1 |
| Topbar | 50 |
| Portal bubbles | 9000 |
| Toast / Install banner | 99999 |

### Naming Conventions

- IDs: kebab-case with semantic prefix (`topbar-back`, `screen-home`, `portal-name-input`)
- Classes: flat BEM-lite — bubble sub-elements use `pb-` prefix (`pb-ring`, `pb-time`, `pb-name`)
- State modifiers: bare words (`.active`, `.done`, `.warning`, `.selected`, `.visible`, `.show`)

## Versioning

- `env.js` defines `APP_VERSION` — single source of truth
- SW imports via `importScripts('./env.js')`, uses it for cache name (`xm-toolkit-v${APP_VERSION}`)
- `app.js` reads the global to display version on the dashboard (`#version-tag`)
- `env.js` is **not cached** by the SW — always fetched from network so version changes propagate
- To release: bump `APP_VERSION` in `env.js` — cache busts automatically

## Service Worker

- Cache name derived from `APP_VERSION` in `env.js`
- **Dev mode** (localhost/127.0.0.1): network-first, cache as offline fallback only
- **Production**: cache-first, then network; caches GET 200 responses; offline falls back to index.html
- `skipWaiting()` + `clients.claim()` for immediate activation

### Background Notifications

- Main thread posts `{ type: 'schedule', id, name, hacks, delay }` to SW via `postMessage`
- SW uses `setTimeout` inside `event.waitUntil()` to keep alive for the timer duration (up to 300s)
- Fires `self.registration.showNotification()` with vibrate pattern when timer completes
- `notificationclick` handler focuses existing window or opens new one
- Cancel via `{ type: 'cancel', id }` message
- **Android**: works reliably in background; users must enable Banner in notification category settings
- **iOS**: only works while PWA is in foreground; background notifications require Push API (not implemented)

## Platform APIs

| API | Purpose |
|-----|---------|
| localStorage | Timer persistence, install-dismiss cooldown |
| Service Worker | Offline support, asset caching, background notification scheduling |
| Vibration API | Haptic feedback on timer completion `[200,100,200]` (Android only) |
| Wake Lock API | Keep screen on while timers are running |
| Notification API | Permission requested on user gesture (first timer add); SW-based delivery |
| beforeinstallprompt | Android PWA install banner with 7-day dismiss cooldown |
| Pointer Events | Bubble drag handling (mouse + touch unified) |

## Development

- Dev server: `php -S localhost:8080` (or any static file server)
- No build/compile step — edit files and reload
- Service worker uses network-first on localhost, so no cache issues during dev
- Test on mobile: use same network + phone browser pointed at `<local-ip>:8080`

## Conventions

- Keep everything in single files (one CSS, one JS) unless a tool grows significantly
- Match Ingress Enlightened faction aesthetic — cyan (#00e5ff) primary, dark backgrounds
- All text uppercase with letter-spacing for HUD feel
- Mobile-first — use `env(safe-area-inset-*)` for iOS notch/home-bar
- No external JS/CSS frameworks — vanilla only
