import test from 'node:test';
import assert from 'node:assert/strict';
import { mosaicLayout } from '../mosaic.js';
import { createFlowerField, generateFlowerSites, safeFlower, flowerLife, singerStyle, singerDensity, FLOWER_LIMITS, FLOWER_RADIUS } from '../flowers.js';
import { createFlight, stepFlight } from '../fly.js';

const seed = 'flower-test', layout = mosaicLayout(seed,48,1152);
const view = { left: 0, top: 0, right: 48, bottom: 48 };

test('world flower sites reproduce from seed, keep clearance and vary across seeds', () => {
  const sites = generateFlowerSites(seed,layout);
  assert.deepEqual(sites,generateFlowerSites(seed,layout));
  assert.notDeepEqual(sites,generateFlowerSites('another',layout));
  assert.ok(sites.length > 1000 && sites.length < 12000);
  assert.equal(new Set(sites.map(f => f.id)).size,sites.length);
  assert.ok(Math.min(...sites.map(f=>f.size))<.16);
  assert.ok(Math.max(...sites.map(f=>f.size))>.30,'larger blossoms survive clearance checks');
  assert.ok(sites.every(f=>f.size>=.14 && f.size<=.34 && f.shape<2));
  for (const f of sites) {
    assert.ok(f.tiles.length>=2,'every root is on a shared face seam');
    assert.ok(Number.isInteger(f.x) || Number.isInteger(f.y));
    for (const tile of f.tiles) assert.ok(safeFlower(f,layout[tile]),f.id);
  }
});

test('smooth organic density and sampled populations lead toward the singer', () => {
  const field = createFlowerField(seed,layout);
  const singer = layout.findIndex(c => c.column>=23 && c.column<=26 && c.row>=23 && c.row<=26);
  field.changeSinger(singer,0);
  const bins = [[0,2],[2,4],[4,7]].map(([min,max]) => {
    const sites = field.sites.filter(f => Math.hypot(f.x-field.active.center.x,f.y-field.active.center.y)>=min
      && Math.hypot(f.x-field.active.center.x,f.y-field.active.center.y)<max);
    return sites.filter(f => field.active.flowers.has(f.id)).length/sites.length;
  });
  assert.ok(bins[0] > bins[1]*1.6 && bins[1] > bins[2]*2,JSON.stringify(bins));
  assert.ok([...field.active.flowers.values()].every(f=>f.distance<FLOWER_RADIUS));
  assert.equal(field.visible({left:0,top:0,right:4,bottom:4},21).length,0,'no background or distant flowers');
  const center = {x:24,y:24};
  assert.equal(singerDensity(40,24,center),0);
  for (let x=0;x<48;x+=.1) assert.ok(Math.abs(singerDensity(x,18,center)-singerDensity(x+.01,18,center))<.01);
  assert.notEqual(singerDensity(20,24,center),singerDensity(24,20,center),'no perfect radial symmetry');
  assert.deepEqual(singerStyle(seed,singer),singerStyle(seed,singer));
  assert.ok(new Set(Array.from({length:30},(_,i)=>JSON.stringify(singerStyle(seed,i)))).size>5);
});

test('immediate cues and buds mature over 10–20 seconds; retired flowers stop music and thin gradually', () => {
  const field = createFlowerField(seed,layout);
  field.changeSinger(520,0);
  const patch = field.active, flowers = [...patch.flowers.values()];
  const cues = flowers.filter(f => flowerLife(f,patch,0).bloom===1);
  assert.ok(cues.length>flowers.length*.25 && cues.length<flowers.length*.5);
  const bud = flowers.find(f => !f.cue && f.delay>1);
  assert.equal(flowerLife(bud,patch,0).bloom,0);
  assert.ok(flowerLife(bud,patch,10).bloom>0 && flowerLife(bud,patch,10).bloom<1);
  assert.equal(flowerLife(bud,patch,20).bloom,1);
  field.changeSinger(200,20);
  assert.equal(patch.retired,20);
  assert.equal(flowerLife(bud,patch,20).responsive,false);
  assert.equal(flowerLife(bud,patch,20).dryProgress,0,'no instant brown replacement');
  const fading = flowers.find(f => !f.remnant && f.rank>.7);
  const midway = flowerLife(fading,patch,28);
  assert.ok(midway.opacity>0 && midway.opacity<1 && midway.droop>0 && midway.bloom<1 && midway.growth<flowerLife(fading,patch,20).growth);
  assert.equal(flowerLife(fading,patch,40).opacity,0);
  field.visible(view,41);
  assert.equal(field.retiring.length,0);
  assert.ok(field.remnants.length>0 && field.remnants.length<=3);
  const positions = field.remnants.map(f => [f.id,f.x,f.y]);
  field.visible({left:0,top:0,right:3,bottom:3},42);
  field.visible(view,43);
  assert.deepEqual(field.remnants.map(f => [f.id,f.x,f.y]),positions);
});

test('scroll culling preserves positions; repeated handoffs bound histories and DOM population', () => {
  const field = createFlowerField(seed,layout);
  field.changeSinger(520,0);
  const local = {left:20,top:20,right:28,bottom:28};
  const first = field.visible(local,21).map(item => [item.key,item.f.x,item.f.y]);
  field.visible({left:0,top:0,right:8,bottom:8},21);
  assert.deepEqual(field.visible(local,21).map(item=>[item.key,item.f.x,item.f.y]),first);
  for (let i=0;i<100;i++) {
    field.changeSinger(i,i*22+22);
    const population = field.visible(view,i*22+43);
    assert.ok(population.length<=FLOWER_LIMITS.rendered);
    assert.ok(field.remnants.length<=FLOWER_LIMITS.remnants);
    assert.ok(field.retiring.length<=FLOWER_LIMITS.retiring);
  }
  for (let i=100;i<150;i++) field.changeSinger(i,2300+i/100);
  assert.ok(field.retiring.length<=FLOWER_LIMITS.retiring);
  assert.ok(field.remnants.length<=FLOWER_LIMITS.remnants);
});

test('fly occasionally investigates a flower, departs, and prioritizes viewport pursuit', () => {
  const fly = createFlight(200,200,()=>.5);
  const viewport = {x:0,y:0,width:600,height:800}, world = {width:4680,height:4680};
  fly.time=10; fly.turnAt=0; fly.mode='drift';
  const flower={x:230,y:210};
  stepFlight(fly,1/60,viewport,world,()=>.1,flower);
  assert.ok(fly.flowerUntil>fly.time);
  for (let i=0;i<200;i++) stepFlight(fly,1/60,viewport,world,()=>.1,flower);
  assert.equal(fly.mode,'cross','investigation ends with normal departure');
  const farView={...viewport,x:1800,y:1800};
  fly.flowerUntil=fly.time+10;
  for (let i=0;i<50;i++) stepFlight(fly,1/60,farView,world,()=>.1,flower);
  assert.equal(fly.following,true);
  assert.equal(fly.flowerUntil,0);
  assert.ok(fly.gx>=farView.x && fly.gy>=farView.y);
});
