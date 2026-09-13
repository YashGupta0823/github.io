# Campus Commute

A top-down "cross the road" game with a light finance/college theme — a student
hustling across town to class, dodging traffic and rivers, grabbing loose cash along
the way. Built with plain HTML, CSS, and JavaScript (no libraries, no build step, no
server required). Made for a class assignment and designed to run directly on GitHub
Pages.

## How to Play

- From the start screen, press **Start**, hit **Enter**/**Space**, or just press a movement key to jump right in.
- Move one tile at a time with **Arrow Keys** or **WASD**.
- Move up (forward) to increase your score — your score is based on the furthest row you've reached.
- Avoid the taxis, delivery vans, and buses moving across the road lanes. Getting hit ends the run.
- River lanes have no safe ground — hop onto a log and ride it. Falling in the water, or
  riding a log completely off the edge of the level, also ends the run.
- Grab the dollar-sign coins that occasionally show up on any lane for bonus points —
  a nice-to-have on top of your distance score, not a replacement for it.
- On game over, click **Restart** or press **R** to play again.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure: canvas, HUD, and game-over screen. |
| `style.css` | Visual styling for the page and UI. |
| `game.js` | All game logic: grid, movement, lane/vehicle/log/coin generation, collision, scoring, game loop. |
| `prompt_log.md` | Log of the prompts used to build this project. |

## Running Locally

No build step or server is required — it's plain static files.

1. Open `index.html` directly in a browser (double-click it, or drag it into a browser window), **or**
2. Serve the folder locally for a more accurate GitHub-Pages-like environment:

   ```bash
   cd crossy-road
   python3 -m http.server 8000
   ```

   Then visit `http://localhost:8000` in your browser.

## Deploying to GitHub Pages

Since this is plain static HTML/CSS/JS, GitHub Pages can serve it as-is. Push this folder to a GitHub repo and enable Pages for the branch/folder containing `index.html` — no build configuration needed.

## Current Scope

- Grid-based movement (one tile per key press)
- Procedurally generated horizontal lanes — grass, road (traffic), and river (logs) — that
  alternate for variety, with a forced grass "breather" after too many hazard lanes in a row
- Collision detection ending the run (vehicles, drowning in water, or riding a log off the map)
- Distance-based scoring with a persisted best score (via `localStorage`), plus a separate
  bonus score from collectible coins — coins add on top, they never replace the distance score
- A start screen (title, one-line pitch, key-cap controls hint, current best) and a
  game-over overlay (total score, a distance/bonus breakdown, best score, restart) —
  both share one visual style and sit inside the canvas frame without covering the HUD
- Chunky, blocky isometric-style rendering, tightly framed and zoomed in (bigger tiles,
  fewer lanes visible at once) so it reads as a dense toy diorama rather than a wide,
  flat view of many thin lanes. Lane strips and blocks (vehicles/player) are extruded
  with shaded side faces for a pseudo-3D look, using one consistent top/right/front
  light recipe everywhere, and the camera keeps the player fixed on screen while the
  world scrolls underneath. Lanes still render far wider than the playable columns so
  the terrain fills the screen edge-to-edge instead of floating as an island.
- Terrain chunking: consecutive lanes of the *same* terrain type (grass-grass,
  road-road, river-river) skip the wall/shadow between them and merge into one
  continuous chunk — a big field, a wide multi-lane road, a wide river — instead of a
  stack of individually-walled stripes. Lane-type generation now also favors clustering
  into these multi-row patches (grass especially) rather than forcing constant
  alternation; the difficulty-limiting rule (a grass "breather" after too many hazard
  rows in a row) is unchanged.
- Vehicles are built from a body + a stepped-up cabin/roof with a windshield glass band
  and small wheel blocks, instead of plain colored boxes — five kinds now (compact,
  taxi, pickup truck, van, bus), the truck using a small cab at one end and a long open
  "bed" for the rest of its length. Logs are thicker, with pale end-grain caps and
  wood-grain shading lines for a rounded, cylindrical read. Grass lanes get scattered
  decorative props (purely cosmetic, no collision) — trees, bushes, rocks, signs,
  benches — placed sparingly so a big field doesn't get cluttered. Roads get dashed
  lane markings, rivers get an animated ripple shimmer plus a sky-reflection gradient;
  every standing object (player/vehicles/logs/coins/props) casts the same stronger,
  consistently-directional ground shadow.
- Scenery variety: every grass lane gets its own small, fixed hue/lightness tint instead
  of one repeating flat green; roads are randomly a wider "avenue" (double dash +
  shoulder lines), a plain "street", or a markings-free "alley" — purely cosmetic, every
  lane is still exactly one row deep; log lengths and vehicle sizes both vary randomly
  within a range instead of one fixed size per kind.
- Animated tile-to-tile hops (short duration, a whole-body vertical bounce arc, a
  squash-and-stretch torso, a lean + "eyes" that orient toward the last direction
  moved) — the logical grid position still updates instantly under the hood, so
  collision and scoring stay simple and reliable
- The player is a stacked figure — small planted legs, a squash/stretch torso, a
  fixed-size head with eyes, and a backpack — instead of one plain cube, sized
  noticeably larger than a single vehicle for a "hero" scale that reads clearly at a
  glance.

Further polish (character/sprite art, sound, additional obstacle types) is left for a
later pass.
