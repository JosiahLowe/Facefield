// All color decisions live here. No feature geometry depends on this theme.
export const PALETTE = {
  skin: ['#A65E49', '#6F805B', '#D0A35B', '#688A8A', '#D6C3A5'],
  eye: '#F5F0E6',
  ink: '#292823',
  background: '#E7DECE',
  paper: '#F5F0E6',
  accent: '#A65E49',
  // Reserved for future features; this theme introduces no new facial features.
  complements: { hair: '#494B3D', lips: '#8D574C', cheeks: '#BD8C77', accessories: '#65746B' },
  flowers: {
    stems: ['#65746B', '#494B3D', '#6F805B'],
    petals: ['#D0A35B', '#BD8C77', '#F5F0E6', '#A65E49', '#D6C3A5'],
    dried: '#95836B',
  },
  variation: { lighter: .08, darker: .06 },
  gradient: { top: .055, bottom: .025 },
  eyelidShade: .18,
  minimumFeatureContrast: 3.05,
};
export function mixColor(color, target, amount) {
  const channels = hex => hex.slice(1).match(/../g).map(c => parseInt(c, 16));
  const a = channels(color), b = channels(target);
  return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function contrastRatio(a, b) {
  const luminance = hex => {
    const c = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
}
export function skinTone(base, tone) {
  const color = mixColor(base, tone < 0 ? PALETTE.ink : PALETTE.paper,
    Math.abs(tone) * (tone < 0 ? PALETTE.variation.darker : PALETTE.variation.lighter));
  // Protect the ink contrast even at the darkest end of the gradient.
  for (let amount = 0; amount <= 1; amount += .005) {
    const candidate = mixColor(color, PALETTE.paper, amount);
    const top = mixColor(candidate, PALETTE.ink, PALETTE.gradient.top);
    if (contrastRatio(top, PALETTE.ink) >= PALETTE.minimumFeatureContrast) return candidate;
  }
  return PALETTE.paper;
}
export const eyelidColor = color => mixColor(color, PALETTE.ink, PALETTE.eyelidShade);
export function applyPalette() {
  for (const key of ['background', 'paper', 'ink', 'accent']) {
    document.documentElement.style.setProperty(`--${key}`, PALETTE[key]);
  }
  document.querySelector('meta[name="theme-color"]').content = PALETTE.background;
}
