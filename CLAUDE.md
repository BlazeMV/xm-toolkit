# XM Toolkit

## Project Overview

Ingress-themed Progressive Web App (PWA) — a multi-tool toolkit for Ingress players. Currently ships a portal hack cooldown tracker, with range calculator and VRBB helper planned.

**Zero dependencies.** Pure vanilla HTML/CSS/JS served as static files. No build step, no bundler, no package.json. Only external resource is Google Fonts CDN (Share Tech Mono + Orbitron).

## Architecture

### File Structure

```
index.html          → Single-page app shell, all screens defined here
css/style.css       → All styles (~450 lines)
js/app.js           → All logic (~290 lines)
sw.js               → Service worker (dev: network-first, prod: cache-first)
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

## Service Worker

- Cache name is versioned (`xm-toolkit-v2`) — bump on releases to bust cache
- **Dev mode** (localhost/127.0.0.1): network-first, cache as offline fallback only
- **Production**: cache-first, then network; caches GET 200 responses; offline falls back to index.html
- `skipWaiting()` + `clients.claim()` for immediate activation

## Platform APIs

| API | Purpose |
|-----|---------|
| localStorage | Timer persistence, install-dismiss cooldown |
| Service Worker | Offline support, asset caching |
| Vibration API | Haptic feedback on timer completion `[200,100,200]` |
| Wake Lock API | Keep screen on while timers are running |
| Notification API | Permission requested on load (not yet used for push) |
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
