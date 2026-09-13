# Prompt Log

This file tracks the prompts used to build and evolve this project with an AI assistant, for class documentation purposes.

## Prompt 1 — Initial Build

> I'm building a browser-based JavaScript game inspired by Crossy Road for a class assignment. It needs to run directly on GitHub Pages with plain HTML/CSS/JavaScript, no npm, no build step, and no server.
>
> Make: style.css, game.js, README.md, prompt_log.md
>
> For this first step, prioritize functionality over visuals. Build a simple playable top-down version with:
> - a player character on a grid
> - arrow-key or WASD movement one tile at a time
> - multiple horizontal road lanes
> - cars moving left or right at different speeds
> - collision detection that ends the run if a car hits the player
> - a score that increases based on the furthest forward distance reached
> - a game-over screen
> - a restart button or key
>
> Keep the code organized and readable because I want to improve it in later prompts. Do not add libraries yet.

**Result:** Created a canvas-based, grid-driven game in `game.js` with:
- A 15x20 tile grid rendered on a 450x600 canvas.
- Procedural lane generation (grass = safe, road = cars), capped consecutive road lanes for fairness.
- A scrolling camera that keeps the player roughly 2/3 down the screen once they've moved far enough forward.
- Cars with randomized speed/direction per lane, wrapping around screen edges.
- AABB collision detection between the player tile and cars in the player's current lane.
- Score tracked as furthest row reached, with a best score persisted in `localStorage`.
- A game-over overlay with a Restart button and the `R` key as a shortcut.

## Prompt 2 — Isometric Visual Overhaul

> Now I want to make the game visually recognizable as Crossy Road.
>
> Transform the current flat presentation into a chunky, blocky, pseudo-3D / 2.5D style while keeping the existing gameplay logic working.
>
> I want: an isometric-like camera angle where the player appears to look diagonally across the lanes, chunky rectangular cars, a blocky player character, roads and grass rendered as thick tiles with visible depth, shadows and simple lighting that create depth, a bright, stylized arcade aesthetic, a camera that visually follows the player as they advance.
>
> Prefer HTML canvas and JavaScript over a heavy framework. If true isometric projection makes sense, implement a simple projection system that converts game-grid coordinates into screen coordinates.
>
> Preserve the current collision and scoring logic. Focus this prompt mostly on rendering and camera perspective.

**Result:** Rewrote only the rendering layer in `game.js`, leaving all gameplay state and logic (`tryMovePlayer`, `updateCars`, `checkCollision`, lane generation, scoring) untouched:
- Added a hand-rolled 2:1 isometric projection (`toIso`) that maps grid position (`col`/tile-units) and lane "depth" onto screen pixels.
- Lane rows are drawn as extruded parallelogram slabs (top face + shaded front wall) instead of flat rectangles.
- Cars and the player are drawn as 3-face shaded blocks (top/right/front) via a shared `drawIsoBlock` helper, using a `shade()` helper that lightens/darkens an HSL color string to fake directional lighting.
- Added soft elliptical ground shadows under cars and the player.
- The camera (`computeCameraOrigin`) is recomputed every frame so the player renders at a fixed screen point; the whole world shifts under them both forward and side-to-side, instead of the old fixed-column camera.
- Enlarged the canvas (840×600) and added a sky gradient background plus an arcade-styled HUD/game-over screen in `style.css`.
- Verified with a headless-Chromium (Playwright) smoke test: launched the page, drove movement via forced game-state, and screenshotted initial/mid-game/game-over states to confirm the projection, camera-follow, shading, and shadows render as intended with no console errors.

## Prompt 3 — Animated Hop Movement

> Improve the player movement so it feels more like Crossy Road: animate each hop over a short duration, give the character a small vertical bounce during the hop, prevent another move from starting until the current hop is mostly complete, rotate or visually orient the character toward the direction of movement if practical, keep collision detection reliable during and after movement. Keep arrow keys/WASD. Don't redesign the whole project; modify the existing movement system cleanly.

**Result:** Modified only the movement/input and rendering-of-player pieces of `game.js`; lane generation, `updateCars`, `checkCollision`, and scoring are untouched:
- `player.row`/`player.col` still update **instantly** the moment a move is accepted (so `checkCollision` keeps checking simple, reliable logical grid state every frame — collision behavior is unchanged and verified to still fire immediately, mid-hop, in a headless-browser test).
- A new `hop` object (`{ fromCol, fromRow, toCol, toRow, startTime }`) drives a purely visual interpolation: `draw()` computes an eased `visualCol`/`visualRow` between the tile just left and the tile just entered over `HOP_DURATION_MS` (150ms), plus a `sin()`-shaped vertical bounce (`HOP_BOUNCE_HEIGHT`).
- `requestMove()` (renamed from `tryMovePlayer`) ignores new key presses until the active hop has crossed `HOP_UNLOCK_PROGRESS` (70%), so hops can't overlap or get cut short — verified with a rapid key-mashing test that only every-other press registered, exactly as the gating math predicts.
- The camera (`computeCameraOrigin`) now follows the animated `visualCol`/`visualRow` instead of the instant logical position, so the whole isometric world glides in sync with the hop rather than snapping ahead of it.
- Added a `facing` direction, persisted across hops, used for two lightweight "orientation" cues instead of a true 3D rotation (impractical for a flat-shaded cube): a small directional lean applied to the top face during the hop (`drawIsoBlock`'s new `topOffset` param), and two small "eye" dots that always sit on the side of the block matching the last direction moved.
- Verified in headless Chromium: screenshotted several frames through a single hop (bounce/lean visible mid-hop, flat and upright once settled with eyes still pointing the last-faced direction), confirmed the movement-gating math against a rapid-fire input test, and confirmed a forced collision still ends the run correctly while mid-hop.

## Prompt 4 — River Lanes

> Add river sections to the game in addition to road and grass lanes. River lanes should visually contain water, moving logs should travel horizontally, the player can safely stand on a log, while standing on a log the player should move horizontally with it, falling into water should cause game over, if a log carries the player completely off the playable area that should also end the run, alternate between road/grass/river so the level has variety. Keep the existing 2.5D rendering style and scoring system.

**Result:** Added a third lane type alongside the existing `grass`/`road` ones in `game.js`; scoring, the isometric projection, and the hop-movement system are unchanged:
- `createRiverLane()` generates a lane with 2-3 wide logs (`LOG_WIDTH`, longer than cars) drifting at a gentler speed range than traffic.
- `generateLaneForRow()` now picks among all three lane types (`pickRandomLaneType()`), still forcing a grass lane after `MAX_CONSECUTIVE_HAZARDS` (now road *or* river) in a row, and additionally re-rolling if the same type would appear three times in a row, so the level visibly mixes all three — verified by generating 300 rows and checking the type distribution and longest same-type run (came out to exactly 3, never more).
- `updateCars` was generalized into `updateLaneObstacles()`, since cars and logs move/wrap identically — only which array on the lane (`cars` vs `logs`) differs.
- The player's row/col are still updated instantly on every hop (unchanged from the animation work), but a log can now also carry the player continuously: `updatePlayerRiverDrift()` adds the lane's velocity to `player.col` every frame the player is standing still on a log (gated on `!hop`, so it doesn't fight an in-flight jump). `requestMove()` now rounds this possibly-fractional drifted position to the nearest tile before computing a jump target, so hopping off a log always snaps back to the grid.
- Two new end conditions in `update()`: `isPlayerSafeOnRiver()` (river lane + no log under the player = drowned) and `isPlayerOffMap()` (drifted a full tile past either edge = swept away). Both were verified directly in a headless-browser test with hand-placed lanes: standing on a log drifted the player at exactly the expected rate and stayed alive; a log placed away from the player drowned them immediately; a fast log carrying the player past the edge ended the run once they were fully off.
- Rendering: river lanes get a blue `WATER_COLOR` slab with two thin lighter ripple lines (`drawWaterRipples`), and logs are drawn as flat brown blocks via the existing `drawIsoBlock` helper — no new rendering primitives needed, everything reuses the prior 2.5D projection/shading system.

## Prompt 5 — Finance/College Reskin + Fullscreen Tracks

> Make the project feel more personal instead of a direct Crossy Road clone: subtle finance/college theme, a blocky student character with a backpack, taxi/van/bus vehicle types, occasional coin/dollar collectibles for bonus points (not replacing distance score), keep it clean/polished not gimmicky, and stretch the tracks/play area to cover the whole screen instead of floating in the air.

**Result:** A visual/content reskin plus one real rendering fix, all in `game.js`/`index.html`/`style.css`; the grid, hop animation, and river/collision logic from earlier prompts are unchanged:
- **Vehicles**: replaced the old random-hue cars with a curated `VEHICLE_KINDS` list (taxi/van/bus — each with its own width, height, color, and accent stripe). Each car in a lane independently picks a kind for mixed traffic; lane speed/direction stay shared so spacing/wrapping logic didn't need to change.
- **Coins**: a lane can get a fixed-position `{ col }` coin (`maybeCreateCoin`, ~22% chance, skipped on the opening safe rows) on *any* lane type. `checkCoinCollection()` runs every frame like the other hazard checks and adds `COIN_VALUE` to a new `bonusScore`. Score display/best-score/game-over now use `getTotalScore() = maxRowReached + bonusScore` — distance is still what drives the score; coins are strictly additive, verified directly (`bonusScore` incremented, coin removed, total = distance + bonus).
- **Player**: recolored to a "student" blue and given a small brown backpack block (`drawBackpack`), offset opposite the facing direction and drawn before the main body so it never covers the face. Getting this to actually *read* as a separate accessory took two iterations — the first offset/size was too small and got fully hidden behind the main body's silhouette (confirmed by computing the exact projected screen bounding boxes of both blocks); sizing it up and offsetting it further out made it clearly visible from every facing direction, checked with zoomed-in screenshots.
- **Fullscreen tracks**: lane slabs now render across `[-LANE_OVERSCAN, COLS+LANE_OVERSCAN]` instead of just `[0, COLS]`, so roads/grass/water run off both edges of the screen — cars/logs/coins still only exist within the original playable width, this is purely a cosmetic extension. This exposed a real gap: the old fixed depth-visibility window (tuned for the narrow view) left a triangular sliver of sky in the top-right/bottom-left corners once lanes got wide. Fixed properly with `depthAtScreenPoint()` — an inverse of the projection that computes exactly which depth range a given screen point corresponds to — used each frame to size the drawn-lane window to the actual canvas corners, plus a bigger lane-generation buffer and retention window so those far lanes actually exist to draw. Verified corner-by-corner (col 0, col 14, and center) with no remaining gaps.

## Prompt 6 — UI Polish (Start Screen, HUD, Game Over)

> Polish the UI: a clean title/start screen, short controls explanation, current score, high score, collectible/bonus score, a clear game-over overlay, a prominent restart button, subtle instructions like "Arrow Keys / WASD to Move". Keep it visually consistent with the blocky 2.5D style and don't cover important gameplay space.

**Result:** UI-only changes across `index.html`/`style.css`/`game.js`; no gameplay logic touched.
- Added a `#start-screen` overlay: title, one-line pitch, a key-cap-styled controls hint (`<kbd>` badges for arrows and WASD), the current best score, and a green **Start** button. Pressing **Enter**/**Space**/any movement key also starts the game (and a movement key both starts *and* makes that first move, verified directly).
- `update()` now no-ops until `hasStarted` is set, so the world sits idle (but still rendered, so the start screen has real scenery behind it) instead of the game silently running before the player has agreed to start. Verified cars/logs stay frozen pre-start.
- HUD gained a third stat, **Bonus: +N**, alongside Score/Best, so collectible coins have their own visible line instead of being invisibly folded into the total.
- The game-over overlay now also shows a `Distance X + Bonus Y` breakdown line and the best score, and both overlays were refactored onto one shared `.overlay-screen`/`.primary-button` CSS so they're visually consistent by construction rather than by copy-paste.
- Both overlays live inside a new `#canvas-wrap` div and are positioned relative to the canvas itself (not the outer container that also holds the HUD), so they can never bleed over the HUD above — confirmed this mattered by actually checking the box model rather than assuming.
- One real bug caught and fixed: a `line-height: 0` on `#canvas-wrap` (added to remove the canvas's inline baseline gap, which `display: block` on the canvas already handled) was inherited by every overlay's text and collapsed all the lines on top of each other. Found via screenshot, fixed by deleting the redundant rule, re-verified.
- The old single "Move with Arrow Keys..." paragraph was replaced with the exact requested subtle phrase, **"Arrow Keys / WASD to Move"**, kept below the canvas outside of gameplay space; the longer flavor description now lives only on the start screen.

## Prompt 7 — Rendering-Only Visual Overhaul

> Don't redesign gameplay or controls — only improve visual quality and push the isometric effect closer to Crossy Road: thicker terrain edges, stronger directional shadows (player/cars/logs/trees/etc.), chunky low-poly vehicles (body/cabin/windshield/wheels), cylindrical-looking logs, more depth/shading on grass/road/water, a slightly exaggerated isometric angle (same camera), and bigger/clearer object scale.

**Result:** Every change is confined to rendering constants and the drawing functions in `game.js`; `update()`, `checkCollision()`, `checkCoinCollection()`, `requestMove()`, lane generation, and scoring are untouched (verified directly — collision, river drift rate, coin pickup, and movement all produce identical numbers to before).
- **Scale/perspective**: `ISO_TILE_W/H` went from 48×24 (exact 2:1) to 56×30 (~1.87:1) — bigger overall and a slightly steeper angle without touching the camera-follow formulas — plus taller wall/block-height constants across the board (`LANE_WALL_HEIGHT`, `CAR_BLOCK_HEIGHT`, `LOG_BLOCK_HEIGHT`, `PLAYER_BLOCK_HEIGHT`) and a smaller player margin so the character reads bigger in its tile.
- **Terrain**: every lane's front wall got taller, plus a new soft "contact shadow" band along each lane's far edge (`drawContactShadow`) — reads as adjacent lanes casting a bit of shadow on each other, reinforcing the stepped-terrain look the request asked for. Roads got a dashed center line (`drawRoadMarkings`); water kept its ripples.
- **Vehicles**: replaced the flat colored box with `drawVehicle` — a body block, small dark "wheel" blocks along the base (`drawWheelBlocks`), a glass-colored windshield band on the front face (`drawFaceBand`), and for taxis specifically a narrower, taller "cabin" block inset over part of the body so it reads as a sedan silhouette rather than a uniform van/bus shape.
- **Logs**: `drawLog` now adds a lighter ridge line along the top center and a pale end-grain ellipse at each end — a cheap "this is a rounded log, not a rectangular block" cue.
- **Trees**: new, purely decorative scenery on grass lanes (`drawTree`, layered canopy blobs + trunk block) — generated once per grass lane at creation time and never consulted by any collision/movement code, so gameplay is provably unaffected.
- **Shadows**: `drawGroundShadow` is now stronger and uses one shared `SHADOW_OFFSET` so every object's shadow falls the same direction; logs and trees, which previously had no shadow at all, now get one too.
- All of this was checked with headless-Chromium screenshots — a full mixed-scene overview plus tight zoomed crops (computed from the actual projected coordinates, not guessed) on a taxi, a log, and the player — and a regression pass that directly called `update()`/`requestMove()`/`checkCoinCollection()` to confirm collision, river drift distance, coin pickup, and scoring all still behave exactly as before the visual pass.

## Prompt 8 — Procedural Scenery Variety

> The environment looks visually repetitive. Add variety — blocky trees, rocks/bushes/signs/benches, subtle grass shade differences, road lane markings, occasional wider/narrower roads, different vehicle shapes/sizes, log length variation, subtle water animation — without changing the core lane mechanics, and without decorative objects ever creating impossible paths.

**Result:** All additions are decorative/cosmetic, generated once at lane-creation time and never consulted by `update()`/collision — verified this stays true with a regression pass (collision, river drift, coin pickup, and movement all still produce the same numbers as before).
- **Grass variety**: each grass lane now gets a small, fixed hue/lightness jitter (`tintColor`, ±10° hue / ±6% lightness) so lanes read as distinct patches instead of one repeating green, plus a generalized decorative-prop system (`lane.props`, replacing the old tree-only `lane.trees`) that scatters trees, bushes, rocks, signs, or benches (weighted toward trees) — same non-colliding guarantee as before.
- **Road variety**: lanes get a cosmetic `roadStyle` (`avenue`/`street`/`alley`) that changes the paint only — double-dash + shoulder lines, a plain single dash, or no markings at all — while remaining exactly one row deep, so nothing about hopping changes.
- **Vehicles**: added a fourth kind (compact car) and a small per-vehicle size jitter (`VEHICLE_SCALE_JITTER`) so same-kind vehicles aren't visually identical; also fixed a real latent bug found while touching this code — `createRoadLane` built cars from `VEHICLE_KINDS` but never copied `kind.hasCabin` onto the car object, so every vehicle was silently rendering as the boxy (van/bus) shape and taxis never actually got their sedan cabin step in real gameplay.
- **Logs**: width is now randomized within a range (`LOG_MIN_WIDTH`–`LOG_MAX_WIDTH`) instead of one fixed length.
- **Water**: ripple lines now drift and pulse in brightness over time (`performance.now()`-driven), instead of sitting static.
- **Bug found and fixed during testing**: a screenshot showed one lane rendering in an odd pale/tan color. Root-caused it (not guessed) by sampling actual canvas pixels per-lane and cross-referencing against lane data — traced to `tintColor()` producing an invalid `hsl(NaN, ...)` string when hue/lightness jitter are missing, which the canvas silently ignores, leaving whatever fillStyle was left over from the previously-drawn object. Only ever triggered by test scripts that hand-built incomplete lane objects (real `createGrassLane()` always sets both jitter fields), but added a defensive fallback in `tintColor` anyway since it's a one-line, zero-risk safety net.

## Prompt 9 — Recognizable Player Silhouette

> The player looks like a small generic block. Rebuild it as a stylized student: blocky head, torso, small legs, backpack, a clear facing direction, a subtle shadow. Keep the hop but add squash/stretch or a vertical arc. Orient the character toward whichever direction it moves. Keep it simple and readable at the current scale.

**Result:** Rewrote only the player-rendering functions in `game.js` (`drawPlayer`, `drawBackpack`, plus a new `drawLegSeam`); nothing about movement, hops, collision, or scoring changed — reconfirmed with the same regression checks used in earlier passes (collision, river drift, coin pickup, movement all unchanged).
- **Stacked body**: `drawIsoBlock` gained a `baseLift` parameter that raises a whole block off the ground plane, so legs → torso → head can be drawn as three separate, correctly-proportioned blocks stacked seamlessly instead of one cube. Legs are small, narrow, and a dark "jeans" color; the torso keeps the existing hoodie-blue; the head is a smaller, fixed-size block in a warm skin tone with the existing eye markers (now anchored to the head specifically). `drawFaceMarkers` also gained a `baseLift` param so the eyes track the head correctly.
- **Backpack**: same idea as before, just now attached at torso height via `baseLift` instead of floating at ground level.
- **Directional lean**: the existing lean-toward-facing effect now applies only to the torso/head/backpack (upper body), while the legs stay planted and upright underneath — reads more like a character leaning into a stride rather than a whole box tilting.
- **Squash-and-stretch + bounce arc**: `bounceHeight` (the existing hop-arc value) now lifts the *entire* stacked body uniformly via `baseLift`, rather than shearing just one block's top rim as before — a true whole-body jump arc. Separately, the torso's height and footprint now scale over the hop (`stretchFactor = sin(progress·π)`): compressed and slightly wider at takeoff/landing, stretched taller and narrower at the peak — classic squash-and-stretch, layered on top of the bounce.
- Verified with headless-Chromium close-up screenshots: the character at rest (head/torso/legs/backpack/shadow all distinguishable), the backpack correctly swapping sides when facing left vs. right, and a sequence of frames through one hop showing the stretch at the peak and the settle back down on landing.

## Prompt 10 — Final Visual Pass: Chunky Crossy-Road Feel

> One final major visual pass — move the overall feel much closer to Crossy Road's chunky, dense, toy-like presentation. Tighter camera/fewer visible lanes, terrain that reads as substantial chunks instead of thin alternating stripes, wider roads/rivers, more recognizable chunky vehicles (car/truck/van/bus with hood/cabin/windshield/wheels), a much bigger player, bigger/dimensional scenery, thicker 3D logs, better water, one consistent light source with stronger shadows. Don't change controls/scoring/collisions/generation logic unless absolutely necessary for rendering.

**Result:** Almost everything here is pure rendering/constant-tuning in `game.js`. The one deliberate exception — flagged up front per the prompt's own caveat — is a small retune of the lane-*type* picker, because "terrain reads as chunks, not stripes" is structurally impossible without lanes actually clustering by type; `MAX_CONSECUTIVE_HAZARDS`, collision, scoring, and movement are all untouched, reconfirmed with the same regression checks used throughout this project (collision, river drift rate, coin pickup, movement all identical).
- **Camera/scale**: `ISO_TILE_W/H` went from 56×30 to 92×50 — a tighter, more zoomed-in frame that shows fewer lanes at once, with no change to the camera-follow formulas (they're already scale-independent).
- **Terrain chunking (the big one)**: `drawLaneSlab` now takes `mergeBehind`/`mergeAhead` flags — when the lane immediately behind/ahead is the *same terrain type*, the wall and contact-shadow at that shared boundary are skipped, so consecutive same-type lanes visually fuse into one continuous chunk (a big field, a multi-lane road, a wide river) instead of each row getting its own separately-walled stripe. `draw()` computes these flags each frame straight from `lanes.get(row-1)`/`lanes.get(row+1)` — no new state.
- **Generation retune (the necessary exception)**: `pickRandomLaneType` now takes the previous lane's type and has a real chance to repeat it (55% for grass, 30% for road/river) instead of the old rule that actively avoided 3-in-a-row of the same type. `MAX_CONSECUTIVE_HAZARDS` (still 3) is the only remaining difficulty guard, unchanged.
- **Vehicles**: added a `truck` kind and generalized the existing cabin mechanic with a `cabinFraction` — a small cab at one end and a long flat "bed" for the rest, reusing the same body/cabin/windshield/wheel-block machinery already built for taxis, just reparameterized.
- **Logs**: thicker (`LOG_BLOCK_HEIGHT` 14→20), wider footprint, two extra grain lines flanking the highlight ridge, bigger end-grain caps.
- **Water**: added a linear-gradient sky-reflection highlight across the top face, layered under the existing animated ripple shimmer.
- **Player**: doubled down on size — taller leg/torso/head blocks and a much bigger footprint margin (0.14 → 0.06) so the character reads as a "hero" next to a vehicle, not a peer.
- **Scenery**: trees/bushes/rocks/signs/benches all scaled up ~1.6-1.7x (heights and pixel-space ellipse sizes only — tile-relative footprints didn't need touching, since they scale automatically with the bigger tiles); per-lane prop chance lowered slightly (0.4→0.3) since grass lanes now often run several rows deep, so the *total* amount of scenery stays similar rather than multiplying.
- **Lighting**: the three per-face shading deltas (top/right/front) were pulled out into named constants (`TOP_FACE_SHADE`/`RIGHT_FACE_SHADE`/`FRONT_FACE_SHADE`) and pushed further apart for more contrast; `SHADOW_OFFSET` and ground-shadow opacity both increased for stronger, more consistently-directional shadows.
- Verified with headless-Chromium screenshots across several forced-forward scenes (confirmed real, wide merged fields and rivers, all five vehicle silhouettes, bigger scenery) and an extended real-keyboard playthrough with multiple deaths/restarts — zero console errors throughout.

## Notes for Future Prompts

Ideas to revisit in later iterations:
- Add real sprites/character art instead of flat-shaded blocks.
- Add obstacles on grass lanes (trees/logs) and river lanes with logs to ride.
- Add sound effects and background music.
- Add mobile/touch controls (swipe or on-screen buttons).
- Add difficulty scaling (car speed/density increasing with distance).
- Add animations for player movement (hop/squash) and a death animation.
