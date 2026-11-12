import { createFly } from './fly.js?v=white-rounded-3';
import { createSinger } from './singing.js?v=white-rounded-3';
import { createFlowers } from './flowers.js?v=flower-rendering-6';
import { applyPalette } from './palette.js';
import { mosaicLayout } from './mosaic.js';
applyPalette();
import { renderFace } from './faces.js?v=square-faces-4';
import { animateFaces } from './behavior.js?v=fly-crossings-1';
const WORLD_COLUMNS = 48;
const WORLD_FACE_COUNT = WORLD_COLUMNS * WORLD_COLUMNS / 2;
const world = document.querySelector('#world');
const grid = document.querySelector('#grid');
function sizeWorld() {
  const viewportColumns = world.clientWidth >= 1000 ? 12 : world.clientWidth >= 600 ? 8 : 4;
  const cellSize = world.clientWidth / viewportColumns;
  grid.style.width = `${WORLD_COLUMNS * cellSize}px`;
  grid.style.gridAutoRows = `${cellSize}px`;
}
const flowers = createFlowers(world, grid);
const fly = createFly(world, grid, flowers.nearby);
const animation = animateFaces(grid, now => { flowers.update(now); fly.update(now); }, fly.position);
const status = document.querySelector('#status');
const singer = createSinger({ button: document.querySelector('#enable-sound'), status, animation, world,
  onSingerChange: flowers.changeSinger, onMusic: flowers.music });
const freshSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
const url = new URL(location.href);
const seed = url.searchParams.get('seed') || freshSeed();
const revisions = Array(WORLD_FACE_COUNT).fill(0);
let layout;
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
  singer.setFace(null);
  animation.clear();
  layout = mosaicLayout(seed, WORLD_COLUMNS, WORLD_FACE_COUNT);
  flowers.reset(seed, layout);
  grid.style.gridTemplateColumns = `repeat(${WORLD_COLUMNS}, minmax(0, 1fr))`;
  sizeWorld();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < WORLD_FACE_COUNT; i++) {
    const tile = document.createElement('button');
    tile.className = 'face';
    tile.dataset.index = i;
    tile.setAttribute('aria-label', `Face ${i + 1}`);
    tile.tabIndex = -1;
    const cell = layout[i];
    tile.style.gridArea = `${cell.row} / ${cell.column} / span ${cell.height} / span ${cell.width}`;
    paint(tile, i);
    fragment.append(tile);
  }
  grid.replaceChildren(fragment);
  // Choose one existing face nearest the world's center; no new face or seed state.
  const distance = cell => (cell.column - 1 + cell.width / 2 - WORLD_COLUMNS / 2) ** 2
    + (cell.row - 1 + cell.height / 2 - WORLD_COLUMNS / 2) ** 2;
  const singerIndex = layout.reduce((best, cell, i) => distance(cell) < distance(layout[best]) ? i : best, 0);
  singer.setFace(grid.children[singerIndex]);
}
grid.addEventListener('click', event => {
  const tile = event.target.closest('.face');
  if (tile?.dataset.singer === 'true') advanceSinger();
});
syncURL();
populate();
// Begin inside the world, with room to explore left, right, up, and down.
requestAnimationFrame(() => {
  world.scrollTo((world.scrollWidth - world.clientWidth) / 2, (world.scrollHeight - world.clientHeight) / 2);
  fly.place();
});

new ResizeObserver(sizeWorld).observe(world);

function advanceSinger() {
  singer.advanceAfterPhrase(offscreenCandidates);
}
function offscreenCandidates() {
  // Use world coordinates so Safari zoom and viewport offsets cannot make a
  // visible tile look offscreen. Require an additional screen of separation.
  const view = window.visualViewport;
  const width = view?.width || world.clientWidth;
  const height = view?.height || world.clientHeight;
  const left = world.scrollLeft + (view?.offsetLeft || 0);
  const top = world.scrollTop + (view?.offsetTop || 0);
  const unit = grid.clientWidth / WORLD_COLUMNS;
  const offscreen = [...grid.children].filter((tile, index) => {
    if (tile.dataset.singer === 'true') return false;
    const cell = layout[index];
    const x = (cell.column - 1) * unit, y = (cell.row - 1) * unit;
    return x + cell.width * unit <= left - width || x >= left + width * 2
      || y + cell.height * unit <= top - height || y >= top + height * 2;
  });
  if (!offscreen.length) {
    return [];
  }
  return offscreen;
}
