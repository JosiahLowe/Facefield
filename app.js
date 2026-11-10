import { FACE_COUNT, renderFace } from './faces.js';
import { animateFaces } from './behavior.js?v=three-expressions-1';
const grid = document.querySelector('#grid');
const animation = animateFaces(grid);
const testButton = document.querySelector('#test-mouths');
const status = document.querySelector('#status');
const freshSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
const url = new URL(location.href);
let seed = url.searchParams.get('seed') || freshSeed();
let revisions = Array(FACE_COUNT).fill(0);
const saved = url.searchParams.get('v');
if (saved) saved.split('.').slice(0, FACE_COUNT).forEach((value, i) => {
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
  const face = renderFace(seed, index, revisions[index]);
  tile.style.backgroundColor = face.backingColor;
  tile.innerHTML = face.svg;
  animation.register(tile, seed, index, revisions[index]);
}
function populate() {
  animation.clear();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < FACE_COUNT; i++) {
    const tile = document.createElement('button');
    tile.className = 'face';
    tile.dataset.index = i;
    tile.setAttribute('aria-label', `Regenerate face ${i + 1}`);
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
