import test from 'node:test';
import assert from 'node:assert/strict';
import { mosaicLayout } from '../mosaic.js';
import { renderFace } from '../faces.js';
import { PALETTE, contrastRatio, mixColor } from '../palette.js';

test('seeded mosaic packs all shapes without holes or overlaps at each breakpoint', () => {
  for (const seed of ['botanical', 'facefield', 'garden']) {
    const mobile = mosaicLayout(seed,4);
    for (const columns of [4,8,12]) {
      const cells = new Set(), sizes = new Set();
      const layout = mosaicLayout(seed,columns);
      assert.equal(layout.length,192);
      assert.deepEqual(layout,mosaicLayout(seed,columns));
      layout.forEach((tile,i)=>{
        assert.deepEqual([tile.width,tile.height],[mobile[i].width,mobile[i].height]);
        sizes.add(`${tile.width}x${tile.height}`);
        for(let y=tile.row;y<tile.row+tile.height;y++) for(let x=tile.column;x<tile.column+tile.width;x++) {
          assert.ok(x>=1&&x<=columns);
          const key=`${x},${y}`;assert.ok(!cells.has(key));cells.add(key);
        }
      });
      assert.equal(cells.size,384);
      const rows=Math.max(...layout.map(t=>t.row+t.height-1));
      assert.equal(cells.size,columns*rows);
      assert.equal(sizes.size,4);
    }
  }
});

test('theme varies botanical colors and preserves circular eye geometry on rectangular tiles', () => {
  const colors = new Set(), shapes = new Set();
  const layout=mosaicLayout('garden');
  layout.forEach((geometry,i)=>{
    const face=renderFace('garden',i,0,geometry);
    colors.add(face.color);shapes.add(face.shape);
    const top=mixColor(face.color,PALETTE.ink,PALETTE.gradient.top);
    assert.ok(contrastRatio(top,PALETTE.ink)>=3.05);
    assert.ok(PALETTE.skin.includes(face.baseColor));
    assert.ok(face.svg.includes('<rect data-feature="skin"'));
    const rounding=Number(face.svg.match(/data-feature="skin"[^>]* rx="([^"]+)"/)[1]);
    assert.ok(rounding<=12, 'corners never become circular or capsule-shaped');
    assert.ok(face.svg.includes(`fill="${PALETTE.eye}"`));
    assert.ok(face.svg.includes(`stroke="${PALETTE.ink}"`));
    assert.ok(!face.svg.includes('fill="white"')&&!face.svg.includes('stroke="black"'));
    assert.ok(face.svg.includes('<linearGradient'));
    assert.ok(face.svg.includes('data-features transform="translate('));
  });
  assert.ok(colors.size>20);assert.deepEqual([...shapes].sort(), ['rect', 'rounded']);
});
