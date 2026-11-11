import { randomFrom, FACE_COUNT } from './faces.js';

// Each 4 × 4 patch contains eight faces and fills every cell. Rotations and
// reflections give variety without holes, overlap, or layout shifts on tap.
const PATCHES = [
  [[0,0,2,2],[2,0,1,2],[3,0,1,1],[3,1,1,1],[0,2,2,1],[2,2,1,2],[3,2,1,2],[0,3,2,1]],
  [[0,0,2,2],[2,2,2,2],[2,0,2,1],[2,1,2,1],[0,2,1,1],[1,2,1,1],[0,3,1,1],[1,3,1,1]],
  [[0,0,2,1],[2,0,2,1],[0,1,2,1],[2,1,2,1],[0,2,2,2],[2,2,1,2],[3,2,1,1],[3,3,1,1]],
];
export function mosaicLayout(seed, columns = 4, count = FACE_COUNT) {
  if (columns % 4 || count % 8) throw new Error('Mosaic requires columns in fours and faces in eights.');
  const result = [];
  for (let block = 0; block < count / 8; block++) {
    const r = randomFrom(`${seed}:mosaic:${block}`);
    const patch = PATCHES[Math.floor(r() * PATCHES.length)];
    const turns = Math.floor(r() * 4), mirror = r() < .5;
    for (const original of patch) {
      let [x,y,width,height] = original;
      if (mirror) x = 4 - x - width;
      for (let turn = 0; turn < turns; turn++) [x,y,width,height] = [4-y-height,x,height,width];
      result.push({ column: block % (columns / 4) * 4 + x + 1,
        row: Math.floor(block / (columns / 4)) * 4 + y + 1, width, height });
    }
  }
  return result;
}
