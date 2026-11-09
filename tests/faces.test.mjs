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
    const { color, svg } = renderFace('geometry-check', i);
    colors.add(color);
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
    assert.equal(svg.match(/<polyline points="([^"]+)"/)[1].trim().split(/\s+/).length,3);
  }
  assert.deepEqual([...colors].sort(), [...COLORS].sort());
});
