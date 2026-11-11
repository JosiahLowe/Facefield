import { applyPalette } from './palette.js';
import { mosaicLayout } from './mosaic.js';
applyPalette();
import { FACE_COUNT, renderFace } from './faces.js?v=botanical-mosaic-1';
import { animateFaces } from './behavior.js?v=scrollable-world-1';
const WORLD_SCALE = 6;
const WORLD_FACE_COUNT = FACE_COUNT * WORLD_SCALE;
const world = document.querySelector('#world');
const grid = document.querySelector('#grid');
grid.style.width = `${WORLD_SCALE * 100}vw`;
const animation = animateFaces(grid);
const testButton = document.querySelector('#test-mouths');
const status = document.querySelector('#status');
const freshSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
const url = new URL(location.href);
let seed = url.searchParams.get('seed') || freshSeed();
let revisions = Array(WORLD_FACE_COUNT).fill(0);
let layout;
const columnCount = () => WORLD_SCALE * (innerWidth >= 1000 ? 12 : innerWidth >= 600 ? 8 : 4);
const saved = url.searchParams.get('v');
if (saved) saved.split('.').slice(0, WORLD_FACE_COUNT).forEach((value, i) => {
  const revision = parseInt(value, 36);
  if (Number.isSafeInteger(revision) && revision >= 0) revisions[i] = revision;
});
function syncURL() {
  const next = new URL(location.href);
  next.searchParams.set('seed', seed);
  if (revisions.some(Boolean)) next.searchParams.set('v', revisions.map(n => n.toString(36)).join('.'));
  else next.searchParams.delete('v');
  history.replaceState(null, '', next);
}
function paint(tile, index) {
  const face = renderFace(seed, index, revisions[index], layout[index]);
  tile.style.backgroundColor = face.backingColor;
  tile.innerHTML = face.svg;
  animation.register(tile, seed, index, revisions[index]);
}
function populate() {
  animation.clear();
  layout = mosaicLayout(seed, columnCount(), WORLD_FACE_COUNT);
  grid.style.gridTemplateColumns = `repeat(${columnCount()}, minmax(0, 1fr))`;
  grid.style.gridAutoRows = `${grid.clientWidth / columnCount()}px`;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < WORLD_FACE_COUNT; i++) {
    const tile = document.createElement('button');
    tile.className = 'face';
    tile.dataset.index = i;
    tile.setAttribute('aria-label', `Regenerate face ${i + 1}`);
    const cell = layout[i];
    tile.style.gridArea = `${cell.row} / ${cell.column} / span ${cell.height} / span ${cell.width}`;
    paint(tile, i);
    fragment.append(tile);
  }
  grid.replaceChildren(fragment);
}
grid.addEventListener('click', event => {
  const tile = event.target.closest('.face');
  if (!tile) return;
  const index = Number(tile.dataset.index);
  revisions[index]++;
  paint(tile, index);
  syncURL();
});
document.querySelector('#shuffle').addEventListener('click', () => {
  seed = freshSeed();
  revisions.fill(0);
  populate();
  syncURL();
  status.textContent = 'All faces shuffled.';
});
document.querySelector('#seed').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    status.textContent = 'Seed link copied. It reproduces this exact grid.';
    document.querySelector('#seed').textContent = 'Link copied ✓';
  } catch {
    // The address bar always contains the complete reproducible state.
    status.textContent = 'Copy the URL from your address bar to reproduce this grid.';
    document.querySelector('#seed').textContent = 'Seed is in URL';
  }
});
testButton.addEventListener('click', () => {
  animation.changeMouths();
  status.textContent = 'Visible faces are changing expression.';
});
syncURL();
populate();
// Begin inside the world, with room to explore left, right, up, and down.
requestAnimationFrame(() => {
  world.scrollTo((world.scrollWidth - world.clientWidth) / 2, (world.scrollHeight - world.clientHeight) / 2);
});

new ResizeObserver(() => {
  const columns = columnCount();
  layout = mosaicLayout(seed, columns, WORLD_FACE_COUNT);
  grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  grid.style.gridAutoRows = `${grid.clientWidth / columns}px`;
  [...grid.children].forEach((tile, i) => {
    const cell = layout[i];
    tile.style.gridArea = `${cell.row} / ${cell.column} / span ${cell.height} / span ${cell.width}`;
  });
}).observe(grid);
