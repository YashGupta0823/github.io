// ============================================================
// Crossy Road Clone — Core Game Script
// Plain JS + Canvas 2D, no dependencies, no build step.
// ============================================================

// ---------- Config (gameplay grid — logical units, not screen pixels) ----------
const TILE_SIZE = 30;
const COLS = 15; // logical grid width, in tiles
const ROWS = 20; // logical grid height, in tiles
const CANVAS_WIDTH = COLS * TILE_SIZE; // logical lane width used by car math/collision
const CANVAS_HEIGHT = ROWS * TILE_SIZE; // logical lane height (unused directly, kept for symmetry)

// How many rows from the bottom the player stays fixed at once scrolling engages.
const PLAYER_SCREEN_ROW = ROWS - 6;

// The lane strips now stretch to fill the whole screen (see LANE_OVERSCAN),
// which means the camera can see much farther ahead/behind along the
// diagonal than the old narrow view did — these keep enough lanes generated
// and retained to cover every screen corner with no gaps.
const FORWARD_GENERATION_BUFFER = 40;
const RETAINED_ROWS_BEHIND_CAMERA = 6;

const SAFE_START_ROWS = 3; // first N rows are always grass (no cars/logs)
const MAX_CONSECUTIVE_HAZARDS = 3; // road or river lanes in a row before a grass breather

const CAR_MIN_SPEED = 60; // px/sec (logical px, see CANVAS_WIDTH above)
const CAR_MAX_SPEED = 160; // px/sec

const LOG_MIN_SPEED = 40; // px/sec — logs drift a bit gentler than traffic
const LOG_MAX_SPEED = 110; // px/sec
const LOG_MIN_WIDTH = TILE_SIZE * 1.7; // short logs are still enough to stand on
const LOG_MAX_WIDTH = TILE_SIZE * 3.4; // long logs read as a rarer, easier ride

const COIN_SPAWN_CHANCE = 0.22; // odds a given lane gets a collectible
const COIN_VALUE = 10; // bonus points per coin, on top of distance score

const HOP_DURATION_MS = 150; // how long one tile-to-tile hop animation takes
const HOP_UNLOCK_PROGRESS = 0.7; // a new move can start once the current hop is this far done
const HOP_BOUNCE_HEIGHT = 10; // px, peak vertical bounce mid-hop
const HOP_LEAN_PX = 5; // px, how far the character leans toward its facing direction mid-hop

// ---------- Config (isometric rendering — actual screen pixels) ----------
const RENDER_WIDTH = 840;
const RENDER_HEIGHT = 600;
// Bigger tiles than before (was 56x24) so fewer lanes are visible at once —
// a tighter, more "zoomed-in toy diorama" framing instead of a wide, flat
// view of many thin lanes — at a ratio a bit steeper than true 2:1.
const ISO_TILE_W = 92;
const ISO_TILE_H = 50;
const LANE_WALL_HEIGHT = 36; // thick, clearly-visible terrain sides — chunky tiles, not thin stripes
const CAR_BLOCK_HEIGHT = 34; // base height for a vehicle block (varies a bit by kind below)
const LOG_BLOCK_HEIGHT = 20; // logs are thick, chunky cylinders, not flat planks
// The player is built from three stacked blocks (legs, torso, head)
// instead of one plain cube — small legs, a bigger torso, a smaller head —
// and sized noticeably larger than a single vehicle for a "hero" scale.
const PLAYER_LEG_HEIGHT = 11;
const PLAYER_TORSO_HEIGHT = 24;
const PLAYER_HEAD_HEIGHT = 15;
const PLAYER_TOTAL_HEIGHT = PLAYER_LEG_HEIGHT + PLAYER_TORSO_HEIGHT + PLAYER_HEAD_HEIGHT;
const BACKPACK_BLOCK_HEIGHT = PLAYER_TORSO_HEIGHT * 0.85;
const PLAYER_SCREEN_X = RENDER_WIDTH / 2;
const PLAYER_SCREEN_Y = RENDER_HEIGHT * 0.7; // keep the player in the lower-middle of the view

// Lanes are rendered far wider than the playable COLS so the road/grass/water
// visibly runs off both edges of the screen instead of floating as an island —
// only the middle COLS-wide strip is ever actually walkable or has traffic.
const LANE_OVERSCAN = 40;

// A single "light comes from the upper-left" convention, reused for every
// ground shadow so they all fall the same way — small in screen space, not
// tied to tile units, so it stays consistent regardless of ISO_TILE_*.
const SHADOW_OFFSET = { x: 9, y: 12 };

// One consistent directional-light recipe for every block face: top faces
// are brightened, right faces shaded a little, front faces shaded a lot —
// reused everywhere via drawIsoBlock so top/front/side read as distinct,
// consistently-lit 3D surfaces instead of flat color swatches.
const TOP_FACE_SHADE = 20;
const RIGHT_FACE_SHADE = -20;
const FRONT_FACE_SHADE = -38;

const GRASS_COLOR = 'hsl(100, 45%, 42%)';
const ROAD_COLOR = 'hsl(0, 0%, 27%)';
const WATER_COLOR = 'hsl(200, 65%, 45%)';
const LOG_COLOR = 'hsl(28, 45%, 34%)';
const LOG_END_COLOR = 'hsl(32, 40%, 62%)'; // pale cut-log end grain
const TIRE_COLOR = 'hsl(0, 0%, 8%)';
const WINDSHIELD_COLOR = 'hsl(198, 45%, 78%)';
const TREE_TRUNK_COLOR = 'hsl(24, 45%, 28%)';
const TREE_LEAF_COLOR = 'hsl(112, 40%, 34%)';
const BUSH_COLOR = 'hsl(96, 35%, 32%)';
const ROCK_COLOR = 'hsl(210, 8%, 55%)';
const SIGN_POST_COLOR = 'hsl(0, 0%, 62%)';
const SIGN_COLOR = 'hsl(40, 85%, 55%)';
const BENCH_COLOR = 'hsl(20, 40%, 38%)';
const PLAYER_COLOR = 'hsl(212, 55%, 52%)'; // campus-hoodie blue (torso)
const PLAYER_LEG_COLOR = 'hsl(214, 28%, 26%)'; // dark jeans
const PLAYER_HEAD_COLOR = 'hsl(28, 48%, 68%)'; // warm skin tone
const BACKPACK_COLOR = 'hsl(14, 68%, 40%)';
const COIN_COLOR = 'hsl(46, 88%, 56%)';

// Every grass lane gets a small, fixed-at-creation hue/lightness nudge off
// GRASS_COLOR so consecutive grass lanes read as distinct patches of lawn
// instead of one repeating flat green.
const GRASS_HUE_JITTER = 10;
const GRASS_LIGHTNESS_JITTER = 6;

// A small, curated set of vehicle "kinds" instead of random hues — reads as a
// clean, deliberate cast of city traffic rather than a random color generator.
// `hasCabin` gives a stepped-up cabin block; `cabinFraction` is how much of
// the vehicle's length that cabin covers (a sedan/taxi's cabin covers most
// of it; a pickup truck's small cab leaves most of the length as open bed).
const VEHICLE_KINDS = [
  { name: 'compact', width: TILE_SIZE * 1.0, height: CAR_BLOCK_HEIGHT - 6, color: 'hsl(150, 40%, 48%)', accent: 'hsl(0, 0%, 96%)', hasCabin: false },
  { name: 'taxi', width: TILE_SIZE * 1.3, height: CAR_BLOCK_HEIGHT, color: 'hsl(48, 92%, 56%)', accent: 'hsl(0, 0%, 12%)', hasCabin: true, cabinFraction: 0.68 },
  { name: 'truck', width: TILE_SIZE * 2.1, height: CAR_BLOCK_HEIGHT + 4, color: 'hsl(4, 55%, 45%)', accent: 'hsl(0, 0%, 90%)', hasCabin: true, cabinFraction: 0.32 },
  { name: 'van', width: TILE_SIZE * 1.9, height: CAR_BLOCK_HEIGHT + 6, color: 'hsl(32, 25%, 88%)', accent: 'hsl(24, 45%, 42%)', hasCabin: false },
  { name: 'bus', width: TILE_SIZE * 2.6, height: CAR_BLOCK_HEIGHT + 10, color: 'hsl(206, 55%, 42%)', accent: 'hsl(0, 0%, 95%)', hasCabin: false },
];
const VEHICLE_SCALE_JITTER = 0.12; // +/- random size wobble so same-kind vehicles aren't identical

// Purely visual road "widths" — a wider feel gets a shoulder line and a
// double dash, a narrower one drops the center marking entirely. The lane
// is still exactly one row deep either way; nothing about hopping changes.
const ROAD_STYLES = ['avenue', 'street', 'street', 'alley'];

// ---------- Canvas setup ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = RENDER_WIDTH;
canvas.height = RENDER_HEIGHT;

// ---------- HUD / screens ----------
const scoreEl = document.getElementById('score');
const bonusEl = document.getElementById('bonus');
const bestEl = document.getElementById('best');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const startBestScoreEl = document.getElementById('start-best-score');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const finalBreakdownEl = document.getElementById('final-breakdown');
const finalBestScoreEl = document.getElementById('final-best-score');
const restartButton = document.getElementById('restart-button');

// ---------- Game state ----------
let player;
let lanes; // Map<rowNumber, laneObject>
let highestGeneratedRow;
let maxRowReached; // distance component of the score
let bonusScore; // coins collected, on top of distance — never the main driver
let bestScore = Number(localStorage.getItem('crossyBestScore')) || 0;
let isGameOver;
let hasStarted = false; // gates update() until the player leaves the start screen
let lastFrameTime = 0;

function getTotalScore() {
  return maxRowReached + bonusScore;
}

// Hop animation: player.row/col update instantly (so collision/scoring stay
// simple and reliable); `hop` only drives the visual interpolation between
// the tile just left and the tile just entered.
let hop = null; // { fromCol, fromRow, toCol, toRow, startTime }
let facing = { dCol: 0, dRow: 1 }; // last direction faced, for lean + eyes

startBestScoreEl.textContent = String(bestScore);

// ---------- Lane generation ----------
// Grass lanes now often run several rows deep (see pickRandomLaneType), so
// a lower per-lane chance still gives roughly the same overall amount of
// scenery — just placed here and there to break up a big field naturally,
// rather than something on every single row.
const PROP_CHANCE_PER_LANE = 0.3; // odds a grass lane gets one or two decorative props
// Weighted so trees are the most common, the rest are rarer accents.
const PROP_KINDS = ['tree', 'tree', 'tree', 'bush', 'bush', 'rock', 'sign', 'bench'];

// Purely decorative scenery — never checked by collision/movement, so this
// doesn't change gameplay at all, only what a grass lane looks like. Each
// lane also gets a small, fixed hue/lightness nudge so consecutive grass
// lanes don't all read as one identical flat green.
function createGrassLane(row) {
  const props = [];
  if (Math.random() < PROP_CHANCE_PER_LANE) {
    const propCount = Math.random() < 0.25 ? 2 : 1;
    const usedCols = new Set();
    for (let i = 0; i < propCount; i++) {
      const col = Math.floor(Math.random() * COLS);
      if (usedCols.has(col)) continue;
      usedCols.add(col);
      const kind = PROP_KINDS[Math.floor(Math.random() * PROP_KINDS.length)];
      props.push({ col, kind });
    }
  }

  const hueJitter = (Math.random() * 2 - 1) * GRASS_HUE_JITTER;
  const lightnessJitter = (Math.random() * 2 - 1) * GRASS_LIGHTNESS_JITTER;

  return { row, type: 'grass', props, hueJitter, lightnessJitter };
}

function pickVehicleKind() {
  return VEHICLE_KINDS[Math.floor(Math.random() * VEHICLE_KINDS.length)];
}

function createRoadLane(row) {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const speed = CAR_MIN_SPEED + Math.random() * (CAR_MAX_SPEED - CAR_MIN_SPEED);
  // Purely a paint/marking style — the lane is still exactly one row deep
  // either way, so hopping/collision never changes.
  const roadStyle = ROAD_STYLES[Math.floor(Math.random() * ROAD_STYLES.length)];

  const cars = [];
  const carCount = 2 + Math.floor(Math.random() * 2); // 2-3 vehicles per lane
  const spacing = CANVAS_WIDTH / carCount;
  for (let i = 0; i < carCount; i++) {
    const kind = pickVehicleKind();
    // A small per-vehicle size wobble so two taxis in the same run don't
    // look like exact copies of each other.
    const scale = 1 + (Math.random() * 2 - 1) * VEHICLE_SCALE_JITTER;
    cars.push({
      x: i * spacing + Math.random() * (spacing * 0.4),
      width: kind.width * scale,
      height: kind.height * scale,
      color: kind.color,
      accent: kind.accent,
      hasCabin: kind.hasCabin,
      cabinFraction: kind.cabinFraction,
    });
  }

  return { row, type: 'road', direction, speed, cars, roadStyle };
}

function createRiverLane(row) {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const speed = LOG_MIN_SPEED + Math.random() * (LOG_MAX_SPEED - LOG_MIN_SPEED);

  const logs = [];
  const logCount = 2 + Math.floor(Math.random() * 2); // 2-3 logs per river lane
  const spacing = CANVAS_WIDTH / logCount;
  for (let i = 0; i < logCount; i++) {
    logs.push({
      x: i * spacing + Math.random() * (spacing * 0.3),
      width: LOG_MIN_WIDTH + Math.random() * (LOG_MAX_WIDTH - LOG_MIN_WIDTH),
    });
  }

  return { row, type: 'river', direction, speed, logs };
}

// Lanes now favor clustering into multi-row patches — wide fields, wide
// roads, wide rivers — instead of forcing constant alternation. That
// clustering (plus the same-terrain wall/shadow merging in drawLaneSlab)
// is what makes terrain read as chunky patches rather than thin stripes.
// MAX_CONSECUTIVE_HAZARDS below still caps how long a hazard patch can
// get, so this is purely about layout variety, not difficulty.
function pickRandomLaneType(previousType) {
  const continuationChance =
    previousType === 'grass' ? 0.55 : previousType === 'road' || previousType === 'river' ? 0.3 : 0;
  if (previousType && Math.random() < continuationChance) return previousType;

  const roll = Math.random();
  if (roll < 0.34) return 'road';
  if (roll < 0.6) return 'river';
  return 'grass';
}

function generateLaneForRow(row) {
  if (row < SAFE_START_ROWS) {
    return createGrassLane(row);
  }

  // Count how many of the previous lanes were hazards (road or river), to
  // avoid an unfair, uncrossable wall of consecutive obstacles.
  let consecutiveHazards = 0;
  for (let r = row - 1; r >= 0 && r >= row - MAX_CONSECUTIVE_HAZARDS; r--) {
    const lane = lanes.get(r);
    if (lane && lane.type !== 'grass') consecutiveHazards++;
    else break;
  }

  if (consecutiveHazards >= MAX_CONSECUTIVE_HAZARDS) {
    return createGrassLane(row);
  }

  const previousLane = lanes.get(row - 1);
  const type = pickRandomLaneType(previousLane ? previousLane.type : null);

  const lane =
    type === 'road' ? createRoadLane(row) : type === 'river' ? createRiverLane(row) : createGrassLane(row);
  lane.coin = maybeCreateCoin(row);
  return lane;
}

// Coins can land on any lane type — safe grass or a hazardous road/river —
// they're a bonus on top of the distance score, not a replacement for it.
function maybeCreateCoin(row) {
  if (row < SAFE_START_ROWS) return null; // keep the opening stretch simple
  if (Math.random() >= COIN_SPAWN_CHANCE) return null;
  return { col: Math.floor(Math.random() * COLS) };
}

function ensureLanesGeneratedUpTo(row) {
  while (highestGeneratedRow < row) {
    highestGeneratedRow++;
    lanes.set(highestGeneratedRow, generateLaneForRow(highestGeneratedRow));
  }
}

function cleanupOldLanes(cameraBase) {
  const cutoff = cameraBase - RETAINED_ROWS_BEHIND_CAMERA;
  for (const row of lanes.keys()) {
    if (row < cutoff) lanes.delete(row);
  }
}

// ---------- Camera ----------
function getCameraBase(row) {
  return Math.max(0, row - PLAYER_SCREEN_ROW);
}

// Depth is the old "screen row" concept: 0 = farthest visible row, larger = nearer.
// Purely a rendering value — nothing in update()/collision depends on it.
function getLaneDepth(row, cameraBase) {
  return ROWS - 1 - row + cameraBase;
}

// ---------- Init / Restart ----------
function initGame() {
  player = { row: 0, col: Math.floor(COLS / 2) };
  lanes = new Map();
  highestGeneratedRow = -1;
  maxRowReached = 0;
  bonusScore = 0;
  isGameOver = false;
  hop = null;
  facing = { dCol: 0, dRow: 1 };

  ensureLanesGeneratedUpTo(FORWARD_GENERATION_BUFFER); // pre-fill the initial visible area
  gameOverScreen.classList.add('hidden');
  updateHud();
}

function endGame() {
  isGameOver = true;
  const total = getTotalScore();
  if (total > bestScore) {
    bestScore = total;
    localStorage.setItem('crossyBestScore', String(bestScore));
  }
  finalScoreEl.textContent = `Score: ${total}`;
  finalBreakdownEl.textContent = `Distance ${maxRowReached} + Bonus ${bonusScore}`;
  finalBestScoreEl.textContent = String(bestScore);
  bestEl.textContent = `Best: ${bestScore}`;
  gameOverScreen.classList.remove('hidden');
}

function updateHud() {
  scoreEl.textContent = `Score: ${getTotalScore()}`;
  bonusEl.textContent = `Bonus: +${bonusScore}`;
  bestEl.textContent = `Best: ${bestScore}`;
}

function startGame() {
  if (hasStarted) return;
  hasStarted = true;
  startScreen.classList.add('hidden');
}

// ---------- Input ----------
const MOVE_KEYS = {
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

window.addEventListener('keydown', (e) => {
  if (!hasStarted) {
    if (e.code === 'Enter' || e.code === 'Space' || MOVE_KEYS[e.code]) {
      e.preventDefault();
      startGame();
    } else {
      return;
    }
  }

  if (e.code === 'KeyR' && isGameOver) {
    restartGame();
    return;
  }

  if (isGameOver) return;

  const move = MOVE_KEYS[e.code];
  if (!move) return;
  e.preventDefault();

  const [dCol, dRow] = move;
  requestMove(dCol, dRow);
});

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', restartGame);

function getHopProgress(currentHop) {
  if (!currentHop) return 1;
  return Math.min(1, (performance.now() - currentHop.startTime) / HOP_DURATION_MS);
}

function requestMove(dCol, dRow) {
  // Ignore new input until the current hop is mostly finished, so hops
  // never overlap or get cut short mid-animation.
  if (hop && getHopProgress(hop) < HOP_UNLOCK_PROGRESS) return;

  facing = { dCol, dRow };

  // player.col may be mid-drift (fractional) while riding a log; a
  // voluntary hop always snaps to the nearest whole tile, animating
  // smoothly from wherever the log carried them.
  const fromCol = player.col;
  const baseCol = Math.round(fromCol);
  const newCol = Math.min(COLS - 1, Math.max(0, baseCol + dCol));
  const newRow = Math.max(0, player.row + dRow);
  if (newCol === baseCol && newRow === player.row) return; // blocked at the edge

  hop = { fromCol, fromRow: player.row, toCol: newCol, toRow: newRow, startTime: performance.now() };
  player.col = newCol;
  player.row = newRow;

  if (player.row > maxRowReached) {
    maxRowReached = player.row;
    updateHud();
  }

  ensureLanesGeneratedUpTo(player.row + FORWARD_GENERATION_BUFFER);
}

function restartGame() {
  initGame();
}

// ---------- Update ----------

// Cars (road lanes) and logs (river lanes) move and wrap the same way —
// only which array on the lane holds them differs.
function updateLaneObstacles(dt) {
  for (const lane of lanes.values()) {
    const items = lane.type === 'road' ? lane.cars : lane.type === 'river' ? lane.logs : null;
    if (!items) continue;

    for (const item of items) {
      item.x += lane.direction * lane.speed * dt;

      if (lane.direction === 1 && item.x > CANVAS_WIDTH) {
        item.x = -item.width - Math.random() * CANVAS_WIDTH * 0.5;
      } else if (lane.direction === -1 && item.x < -item.width) {
        item.x = CANVAS_WIDTH + Math.random() * CANVAS_WIDTH * 0.5;
      }
    }
  }
}

function getPlayerSpan() {
  const left = player.col * TILE_SIZE + 3;
  return { left, right: left + TILE_SIZE - 6 };
}

function spanOverlapsItem(span, item) {
  return span.right > item.x && span.left < item.x + item.width;
}

function checkCollision() {
  const lane = lanes.get(player.row);
  if (!lane || lane.type !== 'road') return false;

  const span = getPlayerSpan();
  return lane.cars.some((car) => spanOverlapsItem(span, car));
}

// While standing on a river lane, the player must be riding a log —
// carries them along with it (see updatePlayerRiverDrift) and keeps
// them safe. No log under them means they've fallen in the water.
function findLogUnderPlayer(lane) {
  const span = getPlayerSpan();
  return lane.logs.find((log) => spanOverlapsItem(span, log));
}

function isPlayerSafeOnRiver() {
  const lane = lanes.get(player.row);
  if (!lane || lane.type !== 'river') return true;
  return Boolean(findLogUnderPlayer(lane));
}

// A log can carry the player past the edge of the level; once their
// whole tile is off the playable width, the run ends.
function isPlayerOffMap() {
  return player.col + 1 <= 0 || player.col >= COLS;
}

// Only drift while settled between hops — mid-hop the player is
// conceptually airborne, and player.row/col already reflect the tile
// they're jumping to (see requestMove), so drifting here would fight
// that jump instead of smoothly carrying a stationary rider.
function updatePlayerRiverDrift(dt) {
  if (hop) return;

  const lane = lanes.get(player.row);
  if (!lane || lane.type !== 'river') return;

  const log = findLogUnderPlayer(lane);
  if (!log) return;

  player.col += (lane.direction * lane.speed * dt) / TILE_SIZE;
}

// A coin sits at a fixed tile on its lane (unlike cars/logs, it doesn't
// move); collecting it just adds a bonus on top of the distance score.
function checkCoinCollection() {
  const lane = lanes.get(player.row);
  if (!lane || !lane.coin) return;

  const span = getPlayerSpan();
  const coinItem = { x: lane.coin.col * TILE_SIZE, width: TILE_SIZE };
  if (spanOverlapsItem(span, coinItem)) {
    bonusScore += COIN_VALUE;
    lane.coin = null;
    updateHud();
  }
}

function update(dt) {
  if (!hasStarted) return; // idle on the start screen — nothing moves yet

  if (hop && getHopProgress(hop) >= 1) hop = null;

  if (isGameOver) return;

  updateLaneObstacles(dt);
  updatePlayerRiverDrift(dt);
  checkCoinCollection();

  if (checkCollision() || isPlayerOffMap() || !isPlayerSafeOnRiver()) {
    endGame();
  }

  cleanupOldLanes(getCameraBase(player.row));
}

// ============================================================
// Isometric rendering
//
// The game grid itself stays flat (col, row). Rendering projects
// two grid axes — "u" (position across a lane, in tile units) and
// "depth" (getLaneDepth(row): 0 = farthest visible row, larger =
// nearer the camera) — onto screen pixels using a classic 2:1
// isometric formula, then extrudes flat lane strips and blocks
// (cars, player) with simple shaded side faces to fake 3D thickness.
// ============================================================

function toIso(u, depth, origin) {
  return {
    x: origin.x + (u - depth) * (ISO_TILE_W / 2),
    y: origin.y + (u + depth) * (ISO_TILE_H / 2),
  };
}

// Inverse of toIso's depth component — given a screen point, what lane
// depth projects there. Used to figure out exactly which depth range
// needs to be drawn to cover every corner of the canvas (see draw()),
// instead of guessing a fixed margin by hand.
function depthAtScreenPoint(x, y, origin) {
  const uMinusDepth = (x - origin.x) / (ISO_TILE_W / 2);
  const uPlusDepth = (y - origin.y) / (ISO_TILE_H / 2);
  return (uPlusDepth - uMinusDepth) / 2;
}

// Keeps the player anchored at a fixed point on screen; the world
// shifts underneath as (col, depth) change, producing the "camera
// follows the player" effect. Takes the player's *visual* (possibly
// mid-hop) position so the camera glides smoothly instead of snapping.
function computeCameraOrigin(visualCol, playerDepth) {
  const anchorU = visualCol + 0.5;
  const anchorDepth = playerDepth + 0.5;
  return {
    x: PLAYER_SCREEN_X - (anchorU - anchorDepth) * (ISO_TILE_W / 2),
    y: PLAYER_SCREEN_Y - (anchorU + anchorDepth) * (ISO_TILE_H / 2),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

// Unit vector, in screen space, that the player is currently facing —
// derived from the same iso axes as toIso() so it always matches the
// direction lanes/columns actually move on screen.
function getFacingScreenDir() {
  const rawX = (facing.dCol + facing.dRow) * (ISO_TILE_W / 2);
  const rawY = (facing.dCol - facing.dRow) * (ISO_TILE_H / 2);
  const len = Math.hypot(rawX, rawY) || 1;
  return { x: rawX / len, y: rawY / len };
}

// Lightens/darkens an "hsl(h, s%, l%)" string — used for simple
// directional-lighting shading on block faces.
function shade(hsl, deltaLightness) {
  const [h, s, l] = hsl.match(/[\d.]+/g).map(Number);
  const newLightness = Math.min(100, Math.max(0, l + deltaLightness));
  return `hsl(${h}, ${s}%, ${newLightness}%)`;
}

// Like shade(), but also nudges the hue — used to give each grass lane its
// own small, fixed-at-creation tint instead of one repeating flat green.
function tintColor(hsl, deltaHue, deltaLightness) {
  const [h, s, l] = hsl.match(/[\d.]+/g).map(Number);
  const newHue = (h + (deltaHue || 0) + 360) % 360;
  const newLightness = Math.min(100, Math.max(0, l + (deltaLightness || 0)));
  return `hsl(${newHue}, ${s}%, ${newLightness}%)`;
}

function fillPoly(points, color, { stroke = true } = {}) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// A strip for one row, rendered far wider than the playable COLS (see
// LANE_OVERSCAN) so the road/grass/water fills the screen edge-to-edge
// instead of floating as an island: a flat "top" diamond band plus a
// single extruded front wall (the edge nearest the camera).
//
// `mergeBehind`/`mergeAhead` say whether the lane just behind/ahead of
// this one is the *same terrain type* — when it is, we skip the wall and
// contact-shadow at that shared boundary so the two lanes read as one
// continuous chunk of terrain (a wide field, a multi-lane road, a wide
// river) instead of a stack of thin, separately-walled stripes.
function drawLaneSlab(origin, depth, baseColor, lane, mergeBehind, mergeAhead) {
  const farLeft = toIso(-LANE_OVERSCAN, depth, origin);
  const farRight = toIso(COLS + LANE_OVERSCAN, depth, origin);
  const nearRight = toIso(COLS + LANE_OVERSCAN, depth + 1, origin);
  const nearLeft = toIso(-LANE_OVERSCAN, depth + 1, origin);

  fillPoly([farLeft, farRight, nearRight, nearLeft], baseColor);

  if (lane.type === 'river') {
    // A soft sky-reflection highlight across the water's top face, on top
    // of the flat fill — brighter toward the far edge, like light glinting
    // off the surface — plus the ripple shimmer drawn further below.
    const gradient = ctx.createLinearGradient(farLeft.x, farLeft.y, nearLeft.x, nearLeft.y);
    gradient.addColorStop(0, shade(baseColor, 14));
    gradient.addColorStop(1, shade(baseColor, -6));
    fillPoly([farLeft, farRight, nearRight, nearLeft], gradient, { stroke: false });
  }

  // A soft contact shadow along the far edge, where the previous (nearer)
  // lane's raised wall would naturally block some light. Ties adjacent
  // lanes together and reinforces the stepped-terrain look — skipped when
  // the lane ahead is the same terrain, since there's no wall to shadow.
  if (!mergeAhead) {
    drawContactShadow(origin, depth);
  }

  if (lane.type === 'road') {
    drawRoadMarkings(origin, depth, lane.roadStyle);
  } else if (lane.type === 'river') {
    drawWaterRipples(origin, depth, baseColor);
  }

  if (mergeBehind) return; // same terrain continues behind — no seam here

  const nearLeftDown = { x: nearLeft.x, y: nearLeft.y + LANE_WALL_HEIGHT };
  const nearRightDown = { x: nearRight.x, y: nearRight.y + LANE_WALL_HEIGHT };
  fillPoly([nearLeft, nearRight, nearRightDown, nearLeftDown], shade(baseColor, -26));

  // A thin highlight right where the top face meets the front wall —
  // sells that edge as a distinct step rather than a flat color seam.
  ctx.strokeStyle = shade(baseColor, 30);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(nearLeft.x, nearLeft.y);
  ctx.lineTo(nearRight.x, nearRight.y);
  ctx.stroke();
}

function drawContactShadow(origin, depth) {
  const farLeft = toIso(-LANE_OVERSCAN, depth, origin);
  const farRight = toIso(COLS + LANE_OVERSCAN, depth, origin);
  const midLeft = toIso(-LANE_OVERSCAN, depth + 0.14, origin);
  const midRight = toIso(COLS + LANE_OVERSCAN, depth + 0.14, origin);
  fillPoly([farLeft, farRight, midRight, midLeft], 'rgba(0, 0, 0, 0.18)', { stroke: false });
}

// Lane paint, varied by the lane's (purely cosmetic) roadStyle: 'avenue'
// reads as a wider, busier road (double dash + solid shoulder edges),
// 'street' is a plain single dashed line, 'alley' has no paint at all.
// The lane itself is always exactly one row deep — nothing about hopping
// or collision changes between styles.
function drawRoadMarkings(origin, depth, roadStyle) {
  if (roadStyle === 'alley') return;

  ctx.save();
  ctx.setLineDash([16, 14]);
  ctx.strokeStyle = 'rgba(255, 224, 140, 0.42)';
  ctx.lineWidth = 2;
  const dashLines = roadStyle === 'avenue' ? [0.35, 0.65] : [0.5];
  for (const t of dashLines) {
    const left = toIso(-LANE_OVERSCAN, depth + t, origin);
    const right = toIso(COLS + LANE_OVERSCAN, depth + t, origin);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }

  if (roadStyle === 'avenue') {
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    for (const t of [0.08, 0.92]) {
      const left = toIso(0, depth + t, origin);
      const right = toIso(COLS, depth + t, origin);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// A couple of thin lighter lines across the water's top face that slowly
// drift and pulse in brightness — a subtle animated shimmer so water
// reads as moving rather than a static colored slab.
function drawWaterRipples(origin, depth, baseColor) {
  const t = performance.now() / 1000;
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const drift = ((t * 0.12 + i * 0.5) % 1) * 0.7 + 0.15;
    const shimmer = 0.5 + 0.5 * Math.sin(t * 1.6 + i * Math.PI);
    ctx.strokeStyle = shade(baseColor, 14 + shimmer * 12);
    const left = toIso(-LANE_OVERSCAN, depth + drift, origin);
    const right = toIso(COLS + LANE_OVERSCAN, depth + drift, origin);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
}

// A raised rectangular block (car or player): top face + the two
// side faces that face the camera, each shaded differently to fake
// simple directional lighting. `topOffset` nudges just the elevated
// rim sideways (used to fake a lean toward the movement direction).
// `baseLift` raises the *whole* block off the ground plane, so blocks
// can be stacked (legs, then torso, then head) without each one
// re-drawing over the ground.
function drawIsoBlock(origin, u0, u1, d0, d1, height, baseColor, topOffset = { x: 0, y: 0 }, baseLift = 0) {
  const raise = (p) => ({ x: p.x, y: p.y - baseLift });
  const N = raise(toIso(u0, d0, origin));
  const E = raise(toIso(u1, d0, origin));
  const S = raise(toIso(u1, d1, origin));
  const W = raise(toIso(u0, d1, origin));
  const lift = (p) => ({ x: p.x + topOffset.x, y: p.y - height + topOffset.y });

  fillPoly([E, S, lift(S), lift(E)], shade(baseColor, RIGHT_FACE_SHADE)); // right face
  fillPoly([S, W, lift(W), lift(S)], shade(baseColor, FRONT_FACE_SHADE)); // front face
  fillPoly([lift(N), lift(E), lift(S), lift(W)], shade(baseColor, TOP_FACE_SHADE)); // top face
}

// A flat colored band across the front face (S-W edge) of a block,
// between two fractions of its height — used for a vehicle's windshield
// sitting near the roofline.
function drawFaceBand(origin, u0, u1, d0, d1, height, bandFrom, bandTo, color) {
  const S = toIso(u1, d1, origin);
  const W = toIso(u0, d1, origin);
  const at = (p, frac) => ({ x: p.x, y: p.y - height * frac });

  fillPoly([at(S, bandFrom), at(W, bandFrom), at(W, bandTo), at(S, bandTo)], color, { stroke: false });
}

// A couple of small dark blocks along the outer (right-face) edge,
// suggesting wheels without drawing full wheel geometry.
function drawWheelBlocks(origin, u0, u1, d0, d1) {
  const wheelWidth = Math.min(0.16, (u1 - u0) * 0.22);
  const wheelDepth = 0.15;
  const positions = [d0 + (d1 - d0) * 0.18, d0 + (d1 - d0) * 0.82];

  for (const wd of positions) {
    drawIsoBlock(origin, u1 - wheelWidth * 1.4, u1 + wheelWidth * 0.2, wd - wheelDepth / 2, wd + wheelDepth / 2, 10, TIRE_COLOR);
  }
}

// Two small dots on the top face, pushed toward the facing direction,
// so the character visibly "looks" the way it last moved.
function drawFaceMarkers(origin, u0, u1, d0, d1, height, topOffset, baseLift = 0) {
  const center = toIso((u0 + u1) / 2, (d0 + d1) / 2, origin);
  const top = { x: center.x + topOffset.x, y: center.y - baseLift - height + topOffset.y };

  const dir = getFacingScreenDir();
  const perp = { x: -dir.y, y: dir.x };
  const forward = 5;
  const spacing = 3.2;
  const baseX = top.x + dir.x * forward;
  const baseY = top.y + dir.y * forward;

  ctx.fillStyle = '#2b2b2b';
  for (const sign of [1, -1]) {
    ctx.beginPath();
    ctx.arc(baseX + perp.x * spacing * sign, baseY + perp.y * spacing * sign, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A stronger, consistently-directional shadow (see SHADOW_OFFSET) under
// every standing object — player, vehicles, logs, coins, trees — so they
// all visibly plant themselves on the ground the same way.
function drawGroundShadow(origin, u0, u1, d0, d1) {
  const center = toIso((u0 + u1) / 2, (d0 + d1) / 2, origin);
  const rx = Math.max(((u1 - u0) * ISO_TILE_W) / 2, 4);
  const ry = Math.max(((d1 - d0) * ISO_TILE_H) / 2, 3);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(center.x + SHADOW_OFFSET.x, center.y + SHADOW_OFFSET.y, rx, ry * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, RENDER_HEIGHT);
  gradient.addColorStop(0, '#7ed1f5');
  gradient.addColorStop(1, '#cdeec2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
}

// A thin livery stripe across a vehicle's top face — a taxi checker line,
// a van's side accent, a bus's stripe — so each kind reads as deliberate
// rather than just "a different color box."
function drawAccentStripe(origin, u0, u1, d0, d1, height, color) {
  const mid = (d0 + d1) / 2;
  const left = toIso(u0, mid, origin);
  const right = toIso(u1, mid, origin);

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, height * 0.22);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y - height);
  ctx.lineTo(right.x, right.y - height);
  ctx.stroke();
}

// A chunky low-poly vehicle: a body, an optional stepped-up cabin/roof
// (sedans/taxis) narrower than the body, a windshield glass band, small
// wheel blocks along the base, and a livery stripe.
function drawVehicle(origin, car, depth) {
  const u0 = car.x / TILE_SIZE;
  const u1 = (car.x + car.width) / TILE_SIZE;
  const d0 = depth + 0.14;
  const d1 = depth + 0.86;
  const length = u1 - u0;

  drawGroundShadow(origin, u0, u1, d0, d1);
  drawWheelBlocks(origin, u0, u1, d0, d1);

  if (car.hasCabin) {
    const cabinFraction = car.cabinFraction || 0.68;
    const bodyHeight = car.height * 0.55;
    const cabinU1 = u1 - length * 0.08;
    const cabinU0 = cabinU1 - length * cabinFraction; // a small cab leaves a long open "bed" (trucks); a big one leaves a short "hood" (sedans)
    const cabinD0 = d0 + (d1 - d0) * 0.22;
    const cabinD1 = d1 - (d1 - d0) * 0.1;

    drawIsoBlock(origin, u0, u1, d0, d1, bodyHeight, car.color);
    drawIsoBlock(origin, cabinU0, cabinU1, cabinD0, cabinD1, car.height, shade(car.color, 6));
    drawFaceBand(origin, cabinU0, cabinU1, cabinD0, cabinD1, car.height, 0.45, 0.82, WINDSHIELD_COLOR);
    drawAccentStripe(origin, u0, u1, d0, d1, bodyHeight * 0.5, car.accent);
  } else {
    drawIsoBlock(origin, u0, u1, d0, d1, car.height, car.color);
    drawFaceBand(origin, u0, u1, d0, d1, car.height, 0.6, 0.85, WINDSHIELD_COLOR);
    drawAccentStripe(origin, u0, u1, d0, d1, car.height * 0.4, car.accent);
  }
}

// A log with a pale end-grain cap at each end and a lighter ridge along
// its top center — cheap cues that read as "rounded cylinder" rather
// than "rectangular block" without actually curving any geometry.
// A thick, chunky log: a wide block, two extra grain lines flanking the
// central highlight ridge (simple wood-texture shading), and a bigger
// pale end-grain cap at each end so it reads as a solid round trunk
// segment rather than a flat plank.
function drawLog(origin, log, depth) {
  const u0 = log.x / TILE_SIZE;
  const u1 = (log.x + log.width) / TILE_SIZE;
  const d0 = depth + 0.14;
  const d1 = depth + 0.86;
  const midD = (d0 + d1) / 2;

  drawGroundShadow(origin, u0, u1, d0, d1);
  drawIsoBlock(origin, u0, u1, d0, d1, LOG_BLOCK_HEIGHT, LOG_COLOR);

  for (const [t, deltaLightness, width] of [
    [0.5, 24, 2.5],
    [0.32, -10, 1.5],
    [0.68, -10, 1.5],
  ]) {
    const lineD = d0 + (d1 - d0) * t;
    const left = toIso(u0, lineD, origin);
    const right = toIso(u1, lineD, origin);
    ctx.strokeStyle = shade(LOG_COLOR, deltaLightness);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y - LOG_BLOCK_HEIGHT);
    ctx.lineTo(right.x, right.y - LOG_BLOCK_HEIGHT);
    ctx.stroke();
  }

  for (const uEnd of [u0, u1]) {
    const endCenter = toIso(uEnd, midD, origin);
    ctx.fillStyle = LOG_END_COLOR;
    ctx.strokeStyle = shade(LOG_END_COLOR, -25);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(endCenter.x, endCenter.y - LOG_BLOCK_HEIGHT, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// A simple layered-blob tree: a short trunk block plus three overlapping
// canopy ellipses (darker underside, base green, lighter highlight) —
// purely decorative scenery on grass lanes, never checked for collision.
function drawTree(origin, tree, depth) {
  const u0 = tree.col + 0.12;
  const u1 = tree.col + 0.88;
  const d0 = depth + 0.12;
  const d1 = depth + 0.88;
  const trunkHeight = 18;

  drawGroundShadow(origin, u0, u1, d0, d1);
  drawIsoBlock(origin, u0 + 0.3, u1 - 0.3, d0 + 0.3, d1 - 0.3, trunkHeight, TREE_TRUNK_COLOR);

  const center = toIso((u0 + u1) / 2, (d0 + d1) / 2, origin);
  const canopyY = center.y - trunkHeight;

  ctx.fillStyle = shade(TREE_LEAF_COLOR, -12);
  ctx.beginPath();
  ctx.ellipse(center.x, canopyY - 17, 27, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = TREE_LEAF_COLOR;
  ctx.beginPath();
  ctx.ellipse(center.x - 6, canopyY - 29, 20, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade(TREE_LEAF_COLOR, 16);
  ctx.beginPath();
  ctx.ellipse(center.x + 7, canopyY - 36, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A squat two-blob bush — smaller and rounder than a tree, no trunk.
function drawBush(origin, prop, depth) {
  const u0 = prop.col + 0.2;
  const u1 = prop.col + 0.8;
  const d0 = depth + 0.2;
  const d1 = depth + 0.8;

  drawGroundShadow(origin, u0, u1, d0, d1);
  const center = toIso((u0 + u1) / 2, (d0 + d1) / 2, origin);

  ctx.fillStyle = shade(BUSH_COLOR, -10);
  ctx.beginPath();
  ctx.ellipse(center.x, center.y - 11, 22, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = BUSH_COLOR;
  ctx.beginPath();
  ctx.ellipse(center.x - 7, center.y - 18, 17, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade(BUSH_COLOR, 16);
  ctx.beginPath();
  ctx.ellipse(center.x + 6, center.y - 21, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A small rock cluster — two overlapping low blocks of slightly
// different size/shade for an irregular, non-uniform silhouette.
function drawRock(origin, prop, depth) {
  const cu = prop.col + 0.5;
  const cd = depth + 0.5;

  drawGroundShadow(origin, cu - 0.3, cu + 0.3, cd - 0.3, cd + 0.3);
  drawIsoBlock(origin, cu - 0.28, cu + 0.08, cd - 0.24, cd + 0.18, 15, ROCK_COLOR);
  drawIsoBlock(origin, cu - 0.04, cu + 0.3, cd - 0.18, cd + 0.26, 21, shade(ROCK_COLOR, 8));
}

// A signpost: a thin post with a small colored placard near the top.
function drawSign(origin, prop, depth) {
  const cu = prop.col + 0.5;
  const cd = depth + 0.5;
  const postHeight = 40;

  drawGroundShadow(origin, cu - 0.12, cu + 0.12, cd - 0.12, cd + 0.12);
  drawIsoBlock(origin, cu - 0.06, cu + 0.06, cd - 0.06, cd + 0.06, postHeight, SIGN_POST_COLOR);

  const top = toIso(cu, cd, origin);
  const y = top.y - postHeight;
  ctx.fillStyle = SIGN_COLOR;
  ctx.strokeStyle = shade(SIGN_COLOR, -30);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(top.x - 18, y - 25, 36, 21);
  ctx.fill();
  ctx.stroke();
}

// A park bench: a low seat slab with a slightly raised backrest along
// its far edge.
function drawBench(origin, prop, depth) {
  const u0 = prop.col + 0.14;
  const u1 = prop.col + 0.86;
  const d0 = depth + 0.34;
  const d1 = depth + 0.66;

  drawGroundShadow(origin, u0, u1, d0, d1);
  drawIsoBlock(origin, u0, u1, d0, d1, 13, BENCH_COLOR);
  drawIsoBlock(origin, u0, u1, d0, d0 + (d1 - d0) * 0.3, 32, shade(BENCH_COLOR, -10));
}

// Dispatches a decorative grass-lane prop to its drawing function. Purely
// visual — props are never consulted by collision/movement, so they can
// never turn a lane into an impossible path.
function drawProp(origin, prop, depth) {
  if (prop.kind === 'tree') drawTree(origin, prop, depth);
  else if (prop.kind === 'bush') drawBush(origin, prop, depth);
  else if (prop.kind === 'rock') drawRock(origin, prop, depth);
  else if (prop.kind === 'sign') drawSign(origin, prop, depth);
  else if (prop.kind === 'bench') drawBench(origin, prop, depth);
}

// A small "coin" (dollar token) resting on a lane — a subtle bonus
// pickup, not attached to any car/log, so it just sits at a fixed tile.
function drawCoin(origin, coin, depth) {
  const center = toIso(coin.col + 0.5, depth + 0.5, origin);
  const bob = Math.sin(performance.now() / 300 + coin.col) * 3;
  const y = center.y - 16 - bob;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(center.x + SHADOW_OFFSET.x * 0.6, center.y + SHADOW_OFFSET.y * 0.6, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COIN_COLOR;
  ctx.strokeStyle = shade(COIN_COLOR, -30);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(center.x, y, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = shade(COIN_COLOR, -40);
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', center.x, y + 1);
}

// A small block offset toward the back (opposite the facing direction),
// drawn before the torso so it never covers the face — a simple, cheap
// "backpack" silhouette on the student character. `baseLift` keeps it
// riding at torso height rather than down at the character's feet.
function drawBackpack(origin, u0, u1, d0, d1, topOffset, baseLift) {
  const half = 0.28;
  const backU = (u0 + u1) / 2 - facing.dCol * 0.55;
  const backD = (d0 + d1) / 2 - facing.dRow * 0.55;

  drawIsoBlock(
    origin,
    backU - half,
    backU + half,
    backD - half,
    backD + half,
    BACKPACK_BLOCK_HEIGHT,
    BACKPACK_COLOR,
    topOffset,
    baseLift
  );
}

// A thin dark seam down the front-center of the legs, hinting at two
// legs without the cost/complexity of animating them separately.
function drawLegSeam(origin, u0, u1, d1, baseLift) {
  const cu = (u0 + u1) / 2;
  const bottom = toIso(cu, d1, origin);
  const y0 = bottom.y - baseLift;
  const y1 = y0 - PLAYER_LEG_HEIGHT * 0.85;

  ctx.strokeStyle = shade(PLAYER_LEG_COLOR, -22);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bottom.x, y0);
  ctx.lineTo(bottom.x, y1);
  ctx.stroke();
}

// The student character: small planted legs, a squash-and-stretch torso,
// a fixed-size head with eyes, and a backpack — stacked with drawIsoBlock's
// baseLift so they read as one continuous body instead of floating boxes.
function drawPlayer(origin, visualCol, depth, bounceHeight, hopProgress) {
  const margin = 0.06; // a big, "hero-scale" footprint relative to its own tile
  const u0 = visualCol + margin;
  const u1 = visualCol + 1 - margin;
  const d0 = depth + margin;
  const d1 = depth + 1 - margin;
  const cu = (u0 + u1) / 2;
  const cd = (d0 + d1) / 2;

  drawGroundShadow(origin, u0, u1, d0, d1);

  // Lean toward the facing direction, strongest mid-hop — applied to the
  // upper body (torso/head/backpack) only, so the character reads as
  // leaning into its stride while the legs stay planted underneath.
  const leanAmount = Math.sin(Math.min(hopProgress, 1) * Math.PI) * HOP_LEAN_PX;
  const dir = getFacingScreenDir();
  const leanOffset = { x: dir.x * leanAmount, y: dir.y * leanAmount };

  // Squash-and-stretch: compressed and a little wider at takeoff/landing,
  // stretched taller and narrower at the peak of the hop. bounceHeight
  // (a plain vertical lift, via baseLift) carries the whole body through
  // the jump arc on top of this.
  const stretchFactor = Math.sin(Math.min(hopProgress, 1) * Math.PI); // 0 at ends, 1 mid-hop
  const heightScale = 1 + stretchFactor * 0.22 - (1 - stretchFactor) * 0.1;
  const widthScale = 1 - (heightScale - 1) * 0.45;
  const torsoHeight = PLAYER_TORSO_HEIGHT * heightScale;
  const torsoHalfU = ((u1 - u0) / 2) * widthScale;
  const torsoHalfD = ((d1 - d0) / 2) * widthScale;
  const torsoU0 = cu - torsoHalfU;
  const torsoU1 = cu + torsoHalfU;
  const torsoD0 = cd - torsoHalfD;
  const torsoD1 = cd + torsoHalfD;

  // Legs: small, planted, narrower than the torso, and always upright —
  // only bounceHeight moves them, never the lean or the squash/stretch.
  const legInset = 0.14;
  const legU0 = u0 + legInset;
  const legU1 = u1 - legInset;
  const legD0 = d0 + legInset;
  const legD1 = d1 - legInset;
  drawIsoBlock(origin, legU0, legU1, legD0, legD1, PLAYER_LEG_HEIGHT, PLAYER_LEG_COLOR, { x: 0, y: 0 }, bounceHeight);
  drawLegSeam(origin, legU0, legU1, legD1, bounceHeight);

  const torsoBaseLift = PLAYER_LEG_HEIGHT + bounceHeight;
  drawBackpack(origin, u0, u1, d0, d1, leanOffset, torsoBaseLift);
  drawIsoBlock(origin, torsoU0, torsoU1, torsoD0, torsoD1, torsoHeight, PLAYER_COLOR, leanOffset, torsoBaseLift);

  // Head: fixed size (not squash/stretched), narrower than the torso, so
  // the face stays stable and readable regardless of the hop's motion.
  const headInset = (u1 - u0) * 0.18;
  const headU0 = u0 + headInset;
  const headU1 = u1 - headInset;
  const headD0 = d0 + headInset;
  const headD1 = d1 - headInset;
  const headBaseLift = PLAYER_LEG_HEIGHT + torsoHeight + bounceHeight;
  drawIsoBlock(origin, headU0, headU1, headD0, headD1, PLAYER_HEAD_HEIGHT, PLAYER_HEAD_COLOR, leanOffset, headBaseLift);
  drawFaceMarkers(origin, headU0, headU1, headD0, headD1, PLAYER_HEAD_HEIGHT, leanOffset, headBaseLift);
}

function draw() {
  drawSky();

  const hopProgress = getHopProgress(hop);
  const eased = easeOutQuad(hopProgress);
  const visualCol = hop ? lerp(hop.fromCol, hop.toCol, eased) : player.col;
  const visualRow = hop ? lerp(hop.fromRow, hop.toRow, eased) : player.row;
  const bounceHeight = hop ? Math.sin(Math.min(hopProgress, 1) * Math.PI) * HOP_BOUNCE_HEIGHT : 0;

  const cameraBase = getCameraBase(visualRow);
  const playerDepth = getLaneDepth(visualRow, cameraBase);
  const origin = computeCameraOrigin(visualCol, playerDepth);

  // Every corner of the canvas corresponds to some depth value under the
  // current camera; drawing that whole range (with a little padding) is
  // what makes the lanes fill the screen edge-to-edge with no gaps.
  const cornerDepths = [
    depthAtScreenPoint(0, 0, origin),
    depthAtScreenPoint(RENDER_WIDTH, 0, origin),
    depthAtScreenPoint(0, RENDER_HEIGHT, origin),
    depthAtScreenPoint(RENDER_WIDTH, RENDER_HEIGHT, origin),
  ];
  const minVisibleDepth = Math.min(...cornerDepths) - 2;
  const maxVisibleDepth = Math.max(...cornerDepths) + 2;

  const visibleLanes = [];
  for (const [row, lane] of lanes) {
    const depth = getLaneDepth(row, cameraBase);
    if (depth < minVisibleDepth || depth > maxVisibleDepth) continue; // off-screen, skip
    visibleLanes.push({ lane, depth, row });
  }
  visibleLanes.sort((a, b) => a.depth - b.depth); // draw far lanes before near ones

  for (const { lane, depth, row } of visibleLanes) {
    let baseColor;
    if (lane.type === 'road') {
      baseColor = lane.roadStyle === 'alley' ? shade(ROAD_COLOR, -6) : lane.roadStyle === 'avenue' ? shade(ROAD_COLOR, 4) : ROAD_COLOR;
    } else if (lane.type === 'river') {
      baseColor = WATER_COLOR;
    } else {
      baseColor = tintColor(GRASS_COLOR, lane.hueJitter, lane.lightnessJitter);
    }

    // Same-terrain neighbors merge visually into one continuous chunk
    // instead of each row getting its own separate walled-off strip.
    const behindLane = lanes.get(row - 1);
    const aheadLane = lanes.get(row + 1);
    const mergeBehind = Boolean(behindLane && behindLane.type === lane.type);
    const mergeAhead = Boolean(aheadLane && aheadLane.type === lane.type);
    drawLaneSlab(origin, depth, baseColor, lane, mergeBehind, mergeAhead);

    if (lane.type === 'road') {
      for (const car of lane.cars) drawVehicle(origin, car, depth);
    } else if (lane.type === 'river') {
      for (const log of lane.logs) drawLog(origin, log, depth);
    } else if (lane.type === 'grass' && lane.props) {
      for (const prop of lane.props) drawProp(origin, prop, depth);
    }

    if (lane.coin) drawCoin(origin, lane.coin, depth);
  }

  drawPlayer(origin, visualCol, playerDepth, bounceHeight, hopProgress);
}

// ---------- Main loop ----------
function gameLoop(timestamp) {
  const dt = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0;
  lastFrameTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

// ---------- Start ----------
initGame();
requestAnimationFrame(gameLoop);
