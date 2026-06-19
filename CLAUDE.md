# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

In development. Two French design specs drive everything:
- `CAHIER_DES_CHARGES_FNAF_COMPLET.md` — the detailed spec (energy numbers, camera list, AI paths, per-night AI levels). **Authoritative reference for gameplay values** — use these numbers, don't invent.
- `PROJET_FNAF_ENTRE_POTES.md` — higher-level overview.

Both end with the same directive: **modular, commented, easily-modifiable** code aimed at a beginner. Comments and user-facing text are in **French**.

**Done so far:** Phase 1 (office + HUD + game loop), Phase 2 (camera monitor + FNAF-accurate map), and the energy system (Phase 5 core) is live. The office is **panoramic** (`#office-world` wider than `#office-view`, pans on mouse X via the `Pan` module). The camera monitor (`Cameras` module) raises over the office, disables panning, sets `GameState.cameraOpen`. It's raised/lowered by **hovering** the bottom-center `#cam-flip` bar (FNAF-style, not a click) — `mouseenter` → `Cameras.flip()` (250ms debounce); the bar sits at `z-index 40` above the monitor so it stays reachable to lower.

**Clock:** night runs **23h → 06h** (7 in-game hours, crosses midnight). Only the hour is shown (e.g. `23h`, `00h`), FNAF-style. `Clock.progress()` (0→1) drives both the display and the win check (`progress() >= 1`) — don't compare against `endHour` directly because of the midnight wrap.

**Energy:** `Power.drainRate()` = (spec weights: base 1, camera +0.5, each door +1, each light +0.5) × `CONFIG.power.drainScale` (0.16, tunable for difficulty). Drained each tick in `Game.tick`; hitting 0 calls `Game.powerOut()` → `loseNight()`.

**Doors (Phase 3, done):** `Doors` module toggles `GameState.doors[side]` (click); a CSS `.shutter` slides down in `#door-left`/`#door-right`, and closed doors feed the energy drain (+1 each). Door buttons live inside `#office-world` so they're unreachable while the monitor is up (authentic). On power-out, `Game.powerOut()` reopens both doors + kills lights.

**Audio (done):** `Sound` module — **fully Web Audio synthesized**, no asset files needed. One-shots via `Sound.play("name")` (`camOpen`/`camClose`/`camSwitch`/`doorClose`/`doorOpen`/`foxyRun`/`freddyLaugh`/`powerOutMusic`/`victory`/`scream`); loops via `Sound.startLoop`/`stopLoop` (`hum` office fan during a night, `static` while monitor up, `lightBuzz` while any light held). Generators are methods named `sfx_<name>` / `loop_<name>`. Single shared `AudioContext` + `master` gain; mute + volume persisted to `localStorage` (`fnaf_joeffrey_muted`, `fnaf_joeffrey_volume`); context resumes on first user gesture (autoplay policy) and `Sound.suspend()`/`resume()` are tied to pause. Wired throughout (`Doors`, `Lights`, `Cameras`, `AI`, `Game` lifecycle). Jumpscare scream routes through `Sound.play("scream")` so it respects mute. Real files could later override but aren't required.

**Pause menu (done):** `Pause` module — **Escape** opens/closes `#pause` (z 9600). Sets `GameState.paused`, which gates `Game.tick` in the loop (time/AI/energy frozen) and suspends audio. Contains Resume, settings (mute toggle, volume slider, VHS filter toggle via `VHS.setEnabled` persisted to `fnaf_joeffrey_vhs`), and **Menu principal** → `Game.quitToMenu()` (aborts the night, stops loops, back to `#menu-screen`). Replaced the old standalone mute button.

**Jumpscare (Phase 10, done):** `Jumpscare` module. `Game.caught(def)` → `Jumpscare.play(def, ()=>loseNight())`: `#jumpscare` overlay (z 10000, above VHS) shakes/flashes showing `assets/images/jumpscares/<id>.png` if present, else a CSS placeholder face. Sound tries `assets/sounds/jumpscares/<id>.mp3`, falling back to a **Web Audio synthesized screech** (`Jumpscare.screech()`) — no audio asset required. Power-out runs a sequence: `#blackout` (z 9500, eyes fade in) for 2.2s → Joeffrey jumpscare → `loseNight()`. Drop real jumpscare PNG/MP3 at the documented paths to replace placeholders.

**Lights (Phase 4, done):** `Lights` module — **hold** (mousedown/touchstart → on, mouseup/leave → off) the `.light-btn` to light a hallway; `.doorway.lit .hallway` brightens + a warm `::after` glow. Lights drain +0.5 each while held. `Lights.refresh()` is called on night start and power-out. `hall_<side>_lit.png` can later replace the CSS-lit hallway.

**Character cast (FNAF → friends):** Bonnie=**Whizip** (id `whizip`), Chica=**Nolan** (`nolan`), Foxy=**Sidané** (`sidane`), Freddy=**Joeffrey** (`joeffrey`). Player character = **Vincent**. The game title "Five Nights at Joeffrey's" comes from Freddy=Joeffrey. Ids are ascii (no accents); display `name` carries accents. The same ids are the AI-level keys in `data/nights.js`.

**AI (Phases 6–7 done — Whizip + Nolan):** Animatronics defined in `data/animatronics.js` (id, name, `door`, `moveInterval`, `path` of camera ids). Whizip: left door, path `1A→1B→5→2A→2B`. Nolan: right door, path `1A→1B→7→4A→4B`. The `AI` module rolls 1–20 vs `aiLevel` every `moveInterval`; advances one room toward the door; at the corner (last path room) a successful roll **enters** → `Game.caught()` if that door is open, else **resets to start** if closed. Reveals: `AI.occupantsInRoom()` drives `#cam-occupants` (silhouette + name on the viewed camera) and the `.doorway .occupant` silhouette (visible only when that side's light is on). No map dots (authentic). Moves are `console.log`'d for now. **Sidané (Foxy, Phase 8, done):** special actor with `type:"foxy"` in `ANIMATRONICS` (fields `cove`, `stageInterval`, `runTime`, `blockPower`; no `path`). `AI.tickFoxy` runs a 4-stage machine (0 hidden → 3 run) in Pirate Cove (`1C`): advances on a roll when **not** being watched; **viewing cam 1C resets his timer** (holds him back). At stage 3 he `running`s; after `runTime` he hits the **left** door — closed → retreat to stage 0 + drain `blockPower`; open → `Game.caught()`. `roomOf` returns `cove` only while lurking (null once running, so the cove visibly empties = the warning). `atCorner` excludes foxy (no `path`). Sidané is inactive on Night 1 (level 0).

**Joeffrey (Freddy, Phase 9, done):** standard mover, right door, slow `moveInterval` 7000, path `1A→1B→7→4A→4B` (shares the right side with Nolan). Inactive Night 1. Has the authentic Freddy trait via `freezeWhenWatched: true` — `AI.tickStandard` holds his timer while `Cameras.current === roomOf(act)` and the monitor is up (he freezes when watched, advances when you look away). **Full cast done (Phases 6–9).** The doorway `.occupant` shows all names at a corner joined by " · " (e.g. Nolan + Joeffrey).

**Custom Night (done):** `#custom-screen` with one 0–20 slider per animatronic (built from `ANIMATRONICS` in `Menu.showCustom`). `btn-custom` in the main menu is disabled until `Save.data.customUnlocked` (set by `Save.unlockCustom()` when Night 5 is beaten in `winNight`). Starting it calls `Game.startNight(NIGHTS.length+1, aiObject)`; `startNight`/`AI.init` take an optional `customAI` that overrides the night's levels (`GameState.customAI`). Winning a custom night just shows a success message (no unlock).

**Menu + save (Phase 13, done):** App now boots into `#menu-screen` (not straight into a night). `Save` persists `{unlocked}` (highest night, 1–5) to `localStorage` key `fnaf_entre_potes_save`. `Menu` wires New Game (night 1) / Continue (last unlocked) / Night Select (grid, locked nights disabled) / Credits. Winning calls `Save.unlock(night+1)` → `#win-screen`; losing → `#gameover-screen`; both return via `[data-back]` buttons to `Menu.show()`. The rAF loop is started **once** in `Game.init` (not per night) — `tick()` only runs when `GameState.running`.

## Code modules (script.js)

Single-file modular pattern, one object literal per concern, each `init()`-ed by `Game.init()`:
`CONFIG` (gameplay constants from the spec) · `Screens` · `GameState` (single source of truth: power, doors, lights, cameraOpen) · `Clock` (real-time → 00:00–06:00) · `Power` (HUD + planned drain) · `Pan` (panoramic scroll) · `Cameras` (monitor) · `Game` (loop + night lifecycle). Per-night AI levels live in `data/nights.js`; camera list + map coords in `data/cameras.js`.

**Night balance (Phases 11–12, tuned):** Smooth difficulty ramp in `data/nights.js` — N1 tutorial (only Whizip 3 + Nolan 2, Foxy/Freddy dormant) → N5 brutal (13/11/8/10). Sides: left = Whizip + Sidané, right = Nolan + Joeffrey. Fairness aids: `AI.GRACE_MS` (7s startup grace before anyone moves) and a `Sound.play("knock")` cue when a walker reaches its corner (telegraphs "check that side's light"). These are reasoned starting values — adjust per playtest feedback (which night feels too easy/hard). Levers if needed: aiLevels, `moveInterval` (per animatronic), `CONFIG.nightRealSeconds` (endurance), `CONFIG.power.drainScale` (energy economy).

The loop (`Game.tick`) follows the spec order: **AI → energy → doors/lights/cameras → win/lose**. Phases not yet built are marked with `// (Phase N)` comments at their insertion points.

## Asset conventions (decided with the user)

- **Office is panoramic**: `assets/images/office/office.png` at **2560×1080** (the real FNAF office image is in place). Door openings are at roughly left 5–23% / right 77–95% of the world; `.doorway` (`#door-left` left:5%, `#door-right` right:5%, width:18%) is positioned to match — tune these if shutters don't line up. Light-on brightens the real painted hallway via `backdrop-filter` on `.doorway.lit` (no separate lit-hallway image needed). **Closed door** uses real asset `assets/images/office/FNAF_door.png` (transparent 339×800) as `.shutter`'s background, sliding down on `.closed`; the right door reuses the same image mirrored (`#door-right .shutter { scaleX(-1) }`). Optional future overlay (power-out) is a same-size aligned PNG.
- **Cameras**: one base image per room at `assets/images/cameras/cam_<id>.png` (ids: 1A,1B,1C,2A,2B,3,4A,4B,5,6,7).
- **Placeholders are rendered in the DOM, not baked as files**: a styled box shows until the real image loads on top (CSS layering for the office; `<img>` `onload`/`onerror` for cameras). Dropping the real file at the documented path replaces the placeholder with **zero code change** — never commit stand-in image files.
- Claude cannot generate art. The user supplies base room images + transparent friend cut-outs; Claude handles all dynamic states (lights, closed doors, power-out, placing friends) **in code**, not as separate baked images.

**Two image types per friend (both optional, drop-in):**
- **Character/base** `assets/images/animatronics/<id>.png` — transparent cut-out shown wherever they *appear* (cameras, doorway/window occupants, power-out doorway figure). Loaded by the `Sprites` module (preloads at init; `Sprites.apply(el, id)` swaps a CSS silhouette for the photo via background-image + `.has-photo` class which hides the drawn eyes/shape). Falls back to the CSS silhouette if absent. (Joeffrey provided.)
- **Jumpscare** `assets/images/jumpscares/<id>.png` — the screamer face shown over the office on capture. `Jumpscare.loadFace()` auto-keys an opaque (checkerboard) background to transparent; transparent PNGs used as-is. Name is never shown (recognizable face). (Whizip provided.)
- ids are lowercase ascii: `whizip`, `nolan`, `sidane`, `joeffrey`.

## What this is

A browser-based FNAF 1 fangame titled **"Five Nights at Joeffrey's"**: horror gameplay played straight, but the animatronics are replaced by custom PNGs of the creator's friends. Gameplay should stay close to the original FNAF 1. The main menu mimics the FNAF 1 menu (stacked title top-left, `>>` hover cursor, English item labels); other screens are in French.

**Global VHS filter:** `#vhs-overlay` is a single `position: fixed`, `pointer-events: none`, `z-index: 9000` layer at the end of `<body>` — animated SVG `feTurbulence` static + scrolling band + scanlines + vignette (strong: `.vhs-noise` opacity 0.38). The `VHS` module toggles `#vhs-overlay.off` (display:none) per state: shown on **all screens except the office**, but re-shown when the camera monitor is up (cameras keep the VHS look). `VHS.update()` is called from `Screens.show()` and `Cameras.raise/lower()`. Don't add per-screen VHS elements — it's global. Future full-screen jumpscares (Phase 10) may need a z-index above 9000.

## Stack & running

- **Vanilla HTML5 + CSS3 + JavaScript only.** No framework, no build step, no package manager.
- Run by opening `index.html` in a browser (or serving the folder over a static HTTP server for correct asset/audio loading, e.g. `python3 -m http.server`).
- No tests, lint, or build tooling are specified.

## Planned structure (per spec, not yet created)

```
index.html, style.css, script.js
assets/images/{office,cameras,animatronics,jumpscares,ui}/
assets/sounds/{ambience,effects,jumpscares}/
data/nights.js   # per-night AI-level config, kept separate so nights are tunable
```

## Core architecture (target design)

**Game loop** runs a night from 00:00 to 06:00 (~6–8 real minutes). Each tick: check each animatronic's AI → drain energy → resolve doors/lights/cameras → check win/lose.

**Energy system** is the central resource. Starts at 100, drains 1/sec baseline plus per-active-usage costs (cameras +0.5, each closed door +1, each light +0.5). At 0: disable controls, cut the office, run the lose sequence. Exact values are in the cahier des charges — treat them as the spec.

**Animatronic AI**: each character is an object with `name`, `position`, `aiLevel`, `moveCooldown`, `active`. On a timed interval each rolls against its `aiLevel` to attempt advancing one step along a fixed **path** of camera rooms toward a door. Bonnie → left door; Chica and Freddy → right door. Reaching an **open** door = jumpscare/Game Over; a **closed** door sends them back along their path. **Foxy** is a special 4-state machine (hidden → watching → ready → running) at Pirate Cove, attacks the left door; a closed left door resets him to state 0. Per-night `aiLevel` values for all four are tabulated in the cahier (Night 1 → Night 5, increasing).

**Cameras**: 11 fixed cameras (1A–7). Each has an empty image plus variants showing each animatronic present, selected by who currently occupies that room.

**Persistence**: `localStorage` stores the last unlocked night (and future stats).

**Screens**: main menu (New Game / Continue / Night Select / Credits), night-select, 6 AM victory transition, Game Over.

## Working conventions

- Specs and in-game text are in **French**; keep user-facing strings and ideally comments in French to match.
- Build incrementally in the spec's phase order: office/UI → cameras → doors → lights → energy → Bonnie → Chica → Foxy → Freddy → jumpscares → Night 1 → Nights 2–5 → menu → polish.
