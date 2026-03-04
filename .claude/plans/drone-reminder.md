# Drone Hack Reminder

## Status: IMPLEMENTED (v3.4.0)

## Overview

Single-timer drone hack reminder for Ingress players. Ingress allows one drone hack per hour with no in-game reminder. This feature tracks the cooldown and sends idle reminders if the player forgets to hack.

## Architecture

### State & Storage

**`xm-drone` (timer state):**
```json
{ "lastHack": 1709567890123, "hacks": 47 }
```
- `lastHack`: Unix timestamp of last hack (null if never hacked)
- `hacks`: lifetime hack counter

**`xm-drone-config` (settings):**
```json
{ "cooldown": 60, "idleAfter": 4, "idleRepeat": 8 }
```
- `cooldown`: minutes until drone is ready again
- `idleAfter`: hours after last hack before first idle reminder
- `idleRepeat`: hours between subsequent idle reminders

### Visual States

| State | Condition | Color | Display |
|-------|-----------|-------|---------|
| COOLING DOWN | elapsed < cooldown | Cyan (`--enl`) | Countdown `MM:SS` |
| READY | cooldown ≤ elapsed < idleAfter | Green (`--xm`) | `READY` / `HACK NOW` |
| OVERDUE | elapsed ≥ idleAfter | Orange (`--warn`) pulsing | `OVERDUE` + time since ready |

### Notification Flow

On "DRONE HACKED" click:
1. Cancel all existing drone notifications (SW + 4 ntfy IDs)
2. Set `lastHack = Date.now()`, increment `hacks`, save to localStorage
3. Schedule notifications:
   - **SW**: "Drone ready" at cooldown minutes (if `sysNotifEnabled`)
   - **ntfy**: `drone-ready` at cooldown minutes
   - **ntfy**: `drone-idle-1` at idleAfter hours
   - **ntfy**: `drone-idle-2` at idleAfter + idleRepeat hours
   - **ntfy**: `drone-idle-3` at idleAfter + 2×idleRepeat hours
4. Update UI to COOLING DOWN state

### Notification IDs
- `drone-ready` — cooldown complete
- `drone-idle-1`, `drone-idle-2`, `drone-idle-3` — idle reminders

### On App Init / Visibility Change
- Drone state loaded from localStorage before `tick()` (TDZ-safe)
- `updateDroneUI()` called from `tick()` every second
- SW reschedules "ready" notification if still cooling down
- ntfy: NOT resent (already queued server-side)

## Screen UI — `#screen-drone`

Centered layout with:
- SVG ring progress indicator (140×140 viewBox, r=62)
- Drone icon (sun/compass style SVG)
- Countdown text or status label
- Last hack relative time + lifetime hack counter
- "DRONE HACKED" primary action button

## Settings — Drone Reminder Section

Added to bottom of `#screen-settings`:
- Cooldown (minutes) — number input, 1–1440, default 60
- Idle alert after (hours) — number input, 1–72, default 4
- Idle repeat (hours) — number input, 1–72, default 8
- SAVE button persists to `xm-drone-config`

## SW Changes

Extended `schedule` message handler to support `customTitle` and `customBody` fields, falling back to the existing portal timer format for backward compatibility.

## Files Modified

- `index.html` — drone tool card, `#screen-drone`, drone settings section
- `js/app.js` — drone screen registered, ~150 lines: state/config management, notification scheduling/cancellation, UI update in tick loop, settings UI
- `css/style.css` — ~80 lines: drone screen layout, status circle states, overdue pulse animation, number input styling
- `sw.js` — customTitle/customBody support in schedule handler
- `env.js` — version bumped to 3.4.0
