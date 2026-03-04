# ntfy.sh Push Notifications for Cooldown Timer

## Status: IMPLEMENTED (v3.3.1)

## Overview

Optional ntfy.sh push notifications as a reliable cross-platform alternative to SW-based system notifications. ntfy.sh supports scheduled delivery — the app sends the notification request at timer creation with a delay, and ntfy.sh delivers it at the right time, even if the PWA is backgrounded or closed.

## Architecture

### ntfy.sh API

**Schedule** a notification at timer creation:
```
POST https://ntfy.sh/{topic}
X-Message-Id: timer-{timerId}
X-Delay: {seconds}s
X-Title: XM Toolkit
X-Tags: zap
X-Icon: {origin}/assets/icons/icon-192.png

{portalName} READY — HACK {hacks}
```

**Cancel** a scheduled notification (timer removed or force-completed):
```
DELETE https://ntfy.sh/{topic}/timer-{timerId}
```

### Data Flow

1. User configures ntfy topic in settings screen → saved to `localStorage` key `xm-ntfy`
2. When timer is created (`addTimer()`), app POSTs to `/{topic}` with `X-Delay` and `X-Message-Id` headers
3. ntfy.sh holds the message and delivers push notification at the right time
4. If timer is removed/force-completed, app DELETEs `/{topic}/timer-{timerId}` to cancel
5. User receives notification via ntfy app (iOS/Android) — works in background on both platforms

### Notification Channels

Two independent opt-in toggles in settings:

**System Notifications (SW-based):**
- Toggle in settings, disabled by default
- Requests `Notification.requestPermission()` on toggle activation
- SW schedules `showNotification()` via `setTimeout`
- Works foreground on both platforms + background on Android only

**ntfy.sh Notifications:**
- Toggle in settings, disabled by default
- Requires ntfy app installed + subscribed to topic
- Server-side scheduled delivery — works even when PWA is closed
- Works on both iOS and Android reliably

### localStorage Keys

`xm-ntfy`:
```json
{ "server": "https://ntfy.sh", "topic": "xm-a8f3k29x1m4b", "token": "", "enabled": true }
```

`xm-sysnotif`:
```json
{ "enabled": false }
```

## Settings Screen

Accessed via gear icon (⚙) in the topbar. Navigates to `#screen-settings`.

### Layout (top to bottom)
1. **"SYSTEM NOTIFICATIONS" section** — toggle button + permission state label + hint text
2. **"NTFY.SH NOTIFICATIONS" section** — server URL input, topic input with COPY button, access token input (optional, for self-hosted servers with auth), hint text, enable toggle, TEST + SAVE buttons

### Topic Auto-Generation
On first load (no config in localStorage), generates random topic:
```js
'xm-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(36)).join('').slice(0, 12)
```

### Setup Flow (user perspective)
1. Open settings → topic is auto-generated
2. Install ntfy app, subscribe to topic
3. Tap TEST → notification arrives in ntfy app
4. Toggle ON, tap SAVE → done

## Integration Points

- `addTimer()`: sends ntfy POST if enabled
- `removeTimer()`: sends ntfy DELETE if enabled
- Bubble tap (force-complete): cancels ntfy
- Bubble tap (restart done): sends new ntfy
- Init reschedule loop: does NOT resend ntfy (already queued on ntfy servers)
- SW notifications: only scheduled when `sysNotifEnabled` is true
- Auto permission request removed from `addTimer()` — now opt-in via settings toggle

## Files Modified

- `index.html` — gear icon in topbar, `#screen-settings` with system notif + ntfy config UI
- `js/app.js` — `settings` screen registered, ~130 lines: config load/save, ntfy send/cancel/test, settings UI, integration with timer lifecycle
- `css/style.css` — ~80 lines: settings screen layout, inputs, toggle buttons, gear icon
- `env.js` — version bumped to 3.3.0
