// All geometry uses a 100 × 100 coordinate system. Feature builders can be
// extended independently without coupling their random streams.
export const COLORS = ['#F5FF00', '#FF35A8', '#168CFF'];
export const FACE_COUNT = 192;
export function randomFrom(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let n = Math.imul(h ^ h >>> 15, 1 | h);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
const range = (r, a, b) => a + r() * (b - a);
const choose = (r, items) => items[Math.floor(r() * items.length)];
const f = n => Number(n.toFixed(3));
function eyes(r) {
  const radius = range(r, 10, 14), y = range(r, 27, 34);
  const space = range(r, 19, 23), pupil = radius * range(r, .38, .48);
  const angle = range(r, 0, Math.PI * 2);
  const distance = r() < .15 ? 0 : range(r, .35, .86);
  const dx = Math.cos(angle) * (radius - pupil) * distance;
  const dy = Math.sin(angle) * (radius - pupil) * distance;
  return [50 - space, 50 + space].map(x =>
    `<circle cx="${f(x)}" cy="${f(y)}" r="${f(radius)}" fill="white"/><circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="${f(pupil)}" fill="black"/>`).join('');
}
function nose(r) {
  const x = range(r, 47, 53), top = range(r, 43, 46), bottom = range(r, 55, 60);
  const shapes = [
    `${x},${top} ${x},${bottom} ${x + 8},${bottom}`,
    `${x - 5},${top} ${x + 6},${top + 2} ${x + 1},${bottom}`,
    `${x - 6},${bottom} ${x + 2},${top} ${x + 7},${bottom - 1}`,
  ];
  return `<polyline points="${choose(r, shapes)}" fill="none" stroke="black" stroke-width="2" stroke-linejoin="miter"/>`;
}
function mouth(r) {
  const type = Math.floor(r() * 5), width = range(r, 38, 82);
  const x = (100 - width) / 2, y = range(r, 70, 75);
  if (type === 0) {
    const height = range(r, 10, 17), count = Math.floor(range(r, 4, 9));
    let result = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>`;
    for (let i = 1; i < count; i++) result += `<path d="M ${x + width * i / count} ${y} v ${height}" stroke="black" stroke-width="1.1"/>`;
    return result;
  }
  if (type === 1) {
    const height = range(r, 17, 22), count = Math.floor(range(r, 4, 9));
    const tooth = width / count, toothHeight = height * .3;
    let result = `<rect x="${x}" y="${y - 3}" width="${width}" height="${height}" fill="black"/>`;
    const lower = r() > .25;
    for (let i = 0; i < count; i++) {
      if (r() > .15) result += `<rect x="${x + i * tooth + .7}" y="${y - 3}" width="${tooth - 1.4}" height="${toothHeight}" fill="white"/>`;
      if (lower && r() > .2) result += `<rect x="${x + i * tooth + .7}" y="${y - 3 + height - toothHeight}" width="${tooth - 1.4}" height="${toothHeight}" fill="white"/>`;
    }
    return result;
  }
  const bend = type === 2 ? 0 : type === 3 ? range(r, 9, 17) : -range(r, 7, 12);
  return `<path d="M ${x} ${y + 3} Q 50 ${y + 3 + bend} ${x + width} ${y + 3}" fill="none" stroke="black" stroke-width="2.2"/>`;
}
export function renderFace(seed, index, revision = 0) {
  const key = `${seed}:${index}:${revision}`;
  const stream = name => randomFrom(`${key}:${name}`);
  const color = choose(stream('color'), COLORS);
  const radius = stream('corners')() < .22 ? 4 : 0;
  // Matching backing color keeps softly rounded SVG corners completely gapless.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><rect width="100" height="100" rx="${radius}" fill="${color}"/>${eyes(stream('eyes'))}${nose(stream('nose'))}${mouth(stream('mouth'))}</svg>`;
  return { color, svg };
}
