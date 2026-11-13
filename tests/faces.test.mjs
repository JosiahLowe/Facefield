import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFace, COLORS, FACE_COUNT } from '../faces.js';

test('seed and tile revisions reproduce independently', () => {
  const face = renderFace('facefield', 7);
  assert.deepEqual(renderFace('facefield', 7), face);
  assert.notDeepEqual(renderFace('facefield', 7, 1), face);
  assert.notDeepEqual(renderFace('another-seed', 7), face);
});

test('generated eyes stay inside tiles, contain pupils, and share gaze', () => {
  const colors = new Set();
  for (let i = 0; i < FACE_COUNT * 10; i++) {
    const { baseColor, svg } = renderFace('geometry-check', i);
    colors.add(baseColor);
    const circles = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.-]+)"/g)].map(m => m.slice(1).map(Number));
    assert.equal(circles.length, 4);
    const offsets = [];
    for (let j = 0; j < 4; j += 2) {
      const [x,y,r] = circles[j], [px,py,pr] = circles[j+1];
      assert.ok(x-r>=0 && x+r<=100 && y-r>=0 && y+r<=100);
      assert.ok(Math.hypot(px-x,py-y)+pr<=r+.002);
      offsets.push([px-x,py-y]);
    }
    assert.ok(Math.abs(offsets[0][0]-offsets[1][0])<.003);
    assert.ok(Math.abs(offsets[0][1]-offsets[1][1])<.003);
    assert.equal([...svg.matchAll(/data-feature="nose"/g)].length, 1);
    const lids = [...svg.matchAll(/data-feature="eyelid" data-side="([^"]+)"/g)];
    assert.ok(lids.length === 0 || lids.length === 2);
    assert.equal(new Set(lids.map(m => m[1])).size, lids.length ? 1 : 0);
    assert.ok(lids.every(m => ['top', 'bottom'].includes(m[1])));
  }
  assert.deepEqual([...colors].sort(), [...COLORS].sort());
});

test('every nose has an acute or right interior angle, including curve tangents', () => {
  const variants = new Set(), directions = new Set(), styles = new Set();
  let acute = 0, right = 0;
  const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1,
    (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI;
  const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
  for (let i = 0; i < 10000; i++) {
    const { svg } = renderFace(`angle-${i % 7}`, i, i % 3);
    const d = svg.match(/data-feature="nose" d="([^"]+)"/)[1];
    const commands = [...d.matchAll(/([MLQC])\s+([^MLQC]+)/g)].map(m => ({
      type: m[1], values: m[2].trim().split(/\s+/).map(Number),
    }));
    assert.equal(commands.length, 3, 'one continuous bridge and tip');
    const [move, bridge, tip] = commands;
    variants.add(bridge.type + tip.type);
    const style = svg.match(/data-bridge="([^"]+)"/)[1];
    styles.add(style);
    assert.equal(tip.type, 'L', 'tip remains a straight stroke');
    assert.equal(bridge.type, style === 'straight' ? 'L' : 'Q');
    if (bridge.type === 'Q') {
      const direction = Math.sign(tip.values[0] - bridge.values.at(-2));
      const midpoint = (move.values[0] + bridge.values.at(-2)) / 2;
      const bow = direction * (bridge.values[0] - midpoint);
      assert.ok(style === 'convex' ? bow > 0 : bow < 0);
    }
    const start = move.values, joint = bridge.values.slice(-2), end = tip.values.slice(-2);
    directions.add(Math.sign(end[0] - joint[0]));
    const direction = Math.sign(end[0] - joint[0]);
    assert.ok(direction * (start[0] - joint[0]) >= -1e-10,
      'right tips require bottom <= top x; left tips require bottom >= top x');
    // Check every curve control too, so curves cannot bow to the wrong side.
    for (let j = 0; j < bridge.values.length; j += 2) {
      assert.ok(direction * (bridge.values[j] - joint[0]) >= -1e-10);
    }
    const tipSideAngle = angle(subtract(start, joint), [direction, 0]);
    assert.ok(tipSideAngle <= 90 + 1e-10, `tip-side angle ${tipSideAngle}`);
    const bridgeControl = bridge.type === 'L' ? start : bridge.values.slice(-4, -2);
    const tipControl = tip.values.slice(0, 2);
    const interior = angle(subtract(start, joint), subtract(end, joint));
    const tangentInterior = angle(subtract(bridgeControl, joint), subtract(tipControl, joint));
    assert.ok(interior <= 90 + 1e-10, `endpoint angle ${interior}`);
    assert.ok(tangentInterior <= 90 + 1e-10, `tangent angle ${tangentInterior}`);
    if (interior < 90 - 1e-8) acute++; else right++;
  }
  assert.equal(variants.size, 2);
  assert.deepEqual([...styles].sort(), ['concave', 'convex', 'straight']);
  assert.deepEqual([...directions].sort(), [-1, 1]);
  assert.ok(acute > 0 && right > 0);
});

test('eyelids are small circular caps with horizontal edges and visible pupils', () => {
  const sides = new Set();
  for (let i = 0; i < 2000; i++) {
    const { svg } = renderFace('small-lids', i);
    const circles = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.-]+)"/g)].map(m => m.slice(1).map(Number));
    const lids = [...svg.matchAll(/data-feature="eyelid" data-side="([^"]+)" d="([^"]+)"/g)];
    lids.forEach((lid, j) => {
      sides.add(lid[1]);
      const [x,y,r] = circles[j*2], [,py,pr] = circles[j*2+1];
      const [left,cut,rx,ry,,large,sweep,right,endY] = lid[2].match(/-?\d+(?:\.\d+)?/g).map(Number);
      const side = lid[1] === 'top' ? -1 : 1;
      assert.equal(cut, endY, 'horizontal boundary');
      assert.equal(large, 0);
      assert.equal(sweep, side === -1 ? 1 : 0);
      assert.ok(Math.abs(rx-r)<.001 && rx===ry);
      assert.ok(side*(cut-y)>0, 'edge stays on its own side of center');
      assert.ok(Math.abs(Math.hypot(left-x,cut-y)-r)<.002);
      assert.ok(Math.abs(Math.hypot(right-x,cut-y)-r)<.002);
      const t = Math.abs(cut-y)/rx;
      const area = (Math.acos(t)-t*Math.sqrt(1-t*t))/Math.PI;
      assert.ok(area >= .0999 && area <= (side===-1 ? .3501 : .3001));
      assert.ok(side===-1 ? cut < py+pr : cut > py-pr, 'pupil remains visible');
    });
  }
  assert.equal(sides.size, 2);
});


test('resting faces never smile and start with invisible rosy cheeks',()=>{
  for(let i=0;i<500;i++){
    const svg=renderFace('resting-faces',i).svg;
    const d=svg.match(/data-feature="mouth" d="([^"]+)"/)[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(d[3]-(d[1]+d[5])/2<=0,'resting mouth is neutral or a frown');
    assert.ok(svg.includes('data-feature="cheeks" fill="#D58C86" opacity="0"'));
    assert.equal((svg.match(/<circle /g)||[]).length,6,'four eye circles and two cheek circles');
    const cheeks=[...svg.matchAll(/<circle data-feature="cheek" cx="([\d.]+)" cy="55" r="([\d.]+)"/g)];
    assert.equal(cheeks.length,2);
    for(const [,x,r] of cheeks){assert.equal(+r,10,'cheeks use the enlarged circular radius');assert.ok(+x-+r>=0&&+x+ +r<=100,'cheeks stay inside the face');}
    assert.deepEqual(cheeks.map(m=>+m[1]),[16,84],'cheeks sit farther apart');
  }
});
