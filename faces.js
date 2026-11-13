import { PALETTE, mixColor, eyelidColor, skinTone } from './palette.js?v=mourning-garden-24';

// All geometry uses a 100 × 100 coordinate system. Feature builders can be
// extended independently without coupling their random streams.
export const COLORS = PALETTE.skin;
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
function eyes(r, lids, color) {
  const radius = range(r, 10, 14), y = range(r, 27, 34);
  const space = range(r, 19, 23), pupil = radius * range(r, .38, .48);
  const angle = range(r, 0, Math.PI * 2);
  const distance = r() < .15 ? 0 : range(r, .35, .86);
  const dx = Math.cos(angle) * (radius - pupil) * distance;
  const dy = Math.sin(angle) * (radius - pupil) * distance;
  const lidStyle = choose(lids, ['none', 'top', 'bottom']);
  const coverage = range(lids, .1, lidStyle === 'top' ? .35 : .3);
  // Solve the circular-segment area for the desired fraction of the eyeball.
  let low = 0, high = 1;
  for (let i = 0; i < 32; i++) {
    const inset = (low + high) / 2;
    const area = (Math.acos(inset) - inset * Math.sqrt(1 - inset * inset)) / Math.PI;
    if (area > coverage) low = inset; else high = inset;
  }
  const lidInset = (low + high) / 2;
  const lidColor = eyelidColor(color);
  return [50 - space, 50 + space].map(x => {
    let result = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(radius)}" fill="${PALETTE.eye}"/><circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="${f(pupil)}" fill="${PALETTE.ink}"/>`;
    for (const side of [-1, 1]) {
      if (lidStyle !== (side === -1 ? 'top' : 'bottom')) continue;
      // Reduce coverage if needed so at least part of the pupil remains exposed.
      const inset = Math.max(lidInset, (side * dy - pupil * .5) / radius);
      const cut = y + side * radius * inset;
      const halfChord = radius * Math.sqrt(1 - inset * inset);
      // The arc follows the eyeball circle exactly, clipping the skin to a cap.
      result += `<path data-feature="eyelid" data-side="${lidStyle}" d="M ${x - halfChord} ${cut} A ${radius} ${radius} 0 0 ${side === -1 ? 1 : 0} ${x + halfChord} ${cut} Z" fill="${lidColor}"/>`;
    }
    return result;
  }).join('');
}
function nose(r, curves) {
  const x = range(r, 48, 52), bottom = range(r, 55, 61);
  // Bias toward long bridges while retaining occasional medium noses.
  const length = r() < .85 ? range(r, 25, 37) : range(r, 17, 25);
  const top = bottom - length;
  const slant = range(r, -3, 3), foot = choose(r, [-1, 1]) * range(r, 5, 10);
  // Generate the bridge on the tip side of the bend, including vertical noses.
  const lean = Math.sign(foot) * (Math.abs(slant) < .6 ? 0 : Math.abs(slant));
  const flatTip = r() < .4;
  // Upward bridge and outward tip have matching horizontal signs. Their
  // dot product is nonnegative even when the tip is exactly horizontal.
  const rise = flatTip ? 0 : range(r, .5, 2);
  const endY = bottom - rise;
  const direction = Math.sign(foot);
  let style = choose(curves, ['straight', 'convex', 'concave']);
  const intensity = curves() < .85 ? range(curves, .4, 1.5) : range(curves, 2, 4);
  const midpoint = Math.abs(lean) * .5;
  // A concave control may approach the bend's x, but never cross it:
  // that keeps the upward tangent on the tip side of the junction.
  if (style === 'concave' && midpoint === 0) style = 'straight';
  const offset = style === 'convex' ? intensity : -Math.min(intensity, midpoint * .9);
  const controlX = x + direction * (midpoint + offset);
  const start = `M ${x + lean} ${top}`;
  const bridge = style === 'straight'
    ? `L ${x} ${bottom}`
    : `Q ${controlX} ${top + length * .5} ${x} ${bottom}`;
  const path = `${start} ${bridge} L ${x + foot} ${endY}`;
  return `<path data-feature="nose" d="${path}" data-bridge="${style}" fill="none" stroke="${PALETTE.ink}" stroke-width="4" stroke-linejoin="round"/>`;
}

function mouth(r) {
  const type = Math.floor(r() * 2), width = range(r, 28, 55);
  const x = (100 - width) / 2, y = range(r, 70, 75);
  const bend = type === 0 ? 0 : -range(r, 8, 14);
  return `<path data-feature="mouth" d="M ${x} ${y + 3} Q 50 ${y + 3 + bend} ${x + width} ${y + 3}" fill="none" stroke="${PALETTE.ink}" stroke-width="4.4"/>`;
}
export function renderFace(seed, index, revision = 0, geometry = { width: 1, height: 1 }) {
  const key = `${seed}:${index}:${revision}`;
  const stream = name => randomFrom(`${key}:${name}`);
  const baseColor = choose(stream('color'), COLORS);
  const tone = stream('skin-tone')() * 2 - 1;
  const color = skinTone(baseColor, tone);
  const shape = 'rect';
  const unit = Math.min(geometry.width, geometry.height);
  const width = 100 * geometry.width / unit, height = 100 * geometry.height / unit;
  const gradientId = `skin-${index}-${revision}`;
  // Square edges fill every mosaic tile without exposing the backing surface.
  const skin = `<rect data-feature="skin" width="${width}" height="${height}" rx="0" fill="url(#${gradientId})"/>`;
  const top = mixColor(color, PALETTE.ink, PALETTE.gradient.top);
  const bottom = mixColor(color, PALETTE.paper, PALETTE.gradient.bottom);
  const cheeks = `<g data-feature="cheeks" fill="${PALETTE.blush}" opacity="0"><circle data-feature="cheek" cx="16" cy="55" r="10"/><circle data-feature="cheek" cx="84" cy="55" r="10"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" data-skin="${color}" data-base-color="${baseColor}" data-shape="${shape}" aria-hidden="true" focusable="false"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>${skin}<g data-features transform="translate(${(width-100)/2} ${(height-100)/2})">${eyes(stream('eyes'), stream('eyelids'), color)}${cheeks}${nose(stream('nose'), stream('nose-bridge'))}${mouth(stream('mouth'))}</g></svg>`;
  return { color, baseColor, backingColor: color, shape, svg };
}
