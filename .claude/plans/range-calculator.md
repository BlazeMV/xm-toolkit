# Portal Range Calculator

## Status: IMPLEMENTED (v3.2.0)

## Overview
Calculator that lets Ingress players configure a portal's 8 resonators and 0-4 link amps, then shows the resulting link range in real-time as km.

## Game Mechanics

**Base range:** `160 * L^4` meters, where L = average resonator level (sum of 8 reso levels / 8)

**Link Amp types & multipliers:**
| Type | Multiplier |
|------|-----------|
| Rare Link Amp (RLA) | x2 |
| SoftBank Ultra Link (SBUL) | x5 |
| Very Rare Link Amp (VRLA) | x7 |

**Stacking (diminishing returns):** Amps sorted by multiplier descending:
- 1st: 100%, 2nd: 25%, 3rd: 12.5%, 4th: 12.5%
- Formula: `total = amp1*1.0 + amp2*0.25 + amp3*0.125 + amp4*0.125`
- No amps = multiplier of 1

## UI Design

**12 boxes total — 8 reso slots + 4 mod slots.** Tap a box to select it, a picker row appears to set the value.

**Layout (top to bottom):**
1. **Range result** — hero display: large km value (green `--xm` glow, Orbitron 36px)
2. **"RESONATORS" section label** + 4x2 grid of reso boxes (each shows colored resonator sprite + level number)
3. **Level picker** — row of 8 buttons (1-8), appears below reso grid when a slot is tapped
4. **"LINK AMPS" section label** + 1x4 row of mod boxes (each shows colored amp sprite + type label)
5. **Amp type picker** — row of 4 buttons: NONE / RLA / SBUL / VRLA

**Interaction:**
- Tap reso box → highlights it, shows level picker below with current level selected
- Tap level button → sets that reso, recalculates range instantly
- Tap amp box → highlights it, shows type picker, auto-closes reso picker
- Tap amp type → sets that mod, recalculates
- Tapping already-selected box deselects it and hides picker
- Only one picker visible at a time

**Sprites** (from ingress-prime repo, stored in `assets/sprites/`):
- `resonator.png` (136x233, portrait) — CSS mask-image colored per level
- `linkamp.png` (204x178) — CSS mask-image for RLA / VRLA mod slots
- `ultralink.png` (243x190) — CSS mask-image for SBUL mod slots
- Sprites are white PNGs on transparent bg, colored via CSS `mask` + `background-color`

**Ingress level colors** (standard game palette):
| L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 |
|----|----|----|----|----|----|----|-----|
| #fece5a | #ffa630 | #ff7315 | #e40000 | #fd2992 | #eb26cd | #c124e0 | #9627f4 |

**Amp type colors:** RLA: cyan (`--enl`), SBUL: orange (`--warn`), VRLA: green (`--xm`). Via `data-aval` attribute on `.amp-slot`.

**Default state:** Resos `[8,7,6,6,5,5,4,4]` (solo L8 deploy), all 4 mods NONE → 160.18 km.

**No persistence** — ephemeral calculations, not saved to localStorage.

## Files Modified

- `index.html` — range tool card activated, `#screen-range` added with reso grid, amp slots, pickers
- `js/app.js` — `range` screen registered, ~80 lines of calculator logic (state, calcRange, updateResoUI, updateAmpUI, event delegation)
- `css/style.css` — ~165 lines of range calculator styles (CSS mask sprites, level color tinting, picker visibility)
- `sw.js` — sprite files added to ASSETS cache list
- `env.js` — version bumped to 3.2.0
- `assets/sprites/` — resonator.png, linkamp.png, ultralink.png

## Verification Values
- Default (solo L8 deploy, no amps): 160.18 km
- All resos L8 + 4x VRLA: 6,881.28 km
