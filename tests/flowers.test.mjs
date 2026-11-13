import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mosaicLayout } from '../mosaic.js';
import { createFlowerField, generateFlowerSites, safeFlower, flowerLife, singerStyle, singerDensity, FLOWER_LIMITS, FLOWER_RADIUS, flowerMotionProfile, flowerMotion, flowerHeadTurn, flowerAppearance, flowerWeight, flowerPose, flowerPosture } from '../flowers.js';

const seed = 'flower-test', layout = mosaicLayout(seed,48,1152);
const view = { left: 0, top: 0, right: 48, bottom: 48 };

test('moth death clears flowers and history, while new singers can grow again',()=>{
  const field=createFlowerField(seed,layout);
  field.changeSinger(500,0);field.changeSinger(501,30);field.visible(view,60);
  assert.ok(field.visible(view,60).length>0);
  const sites=field.sites;
  field.clear();
  assert.equal(field.active,null);assert.deepEqual(field.retiring,[]);assert.deepEqual(field.remnants,[]);
  assert.deepEqual(field.visible(view,100),[]);
  field.changeSinger(502,101);assert.ok(field.visible(view,120).length>0);
  assert.equal(field.sites,sites,'stable world sites survive the death and recovery');
});

test('world flower sites reproduce from seed, keep clearance and vary across seeds', () => {
  const sites = generateFlowerSites(seed,layout);
  assert.deepEqual(sites,generateFlowerSites(seed,layout));
  const positions=sites.map(({id,x,y,size})=>({id,x,y,size}));
  assert.equal(createHash('sha256').update(JSON.stringify(positions)).digest('hex'),
    '115f48b69370c8ffc38e6ee63f81d36c0b9d123581ade6fd0fe32060f92ca7be','animation changes preserve existing placement');
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

test('seeded flower motion varies independently, blooms occasionally, and stays restrained', () => {
  const sites=generateFlowerSites(seed,layout).slice(0,120);
  const life={responsive:true,dry:false};
  assert.deepEqual(flowerMotionProfile(seed,sites[0].id),sites[0].motion);
  assert.ok(new Set(sites.map(f=>f.motion.speed)).size>100);
  assert.ok(new Set(sites.map(f=>f.motion.amplitude)).size>100);
  let blooming=0,total=0;
  for (const f of sites) {
    for (let t=0;t<90;t+=.5) {
      const quiet=flowerMotion(f,t,life),next=flowerMotion(f,t+1/60,life);
      assert.ok(Math.abs(quiet.sway)<=2.1 && Math.abs(next.sway-quiet.sway)<.04);
      assert.ok(quiet.expansion>=0 && quiet.expansion<=.04);
      if (quiet.bloom>0) blooming++;
      total++;
      const near=flowerMotion(f,t,life,1,4),far=flowerMotion(f,t,life,.15,4);
      assert.ok(near.pulse>far.pulse && near.expansion<=.105);
      assert.ok(Math.abs(near.sway)<=2.4);
    }
  }
  assert.ok(blooming/total>.08 && blooming/total<.3,'long quiet intervals between slow blooms');
  const atOnce=sites.map(f=>flowerMotion(f,30,life));
  assert.ok(atOnce.some(m=>m.bloom===0) && atOnce.some(m=>m.bloom>0),'flowers do not all bloom together');
});

test('decorative flower motion stops for reduced motion and retiring patches', () => {
  const f={motion:flowerMotionProfile(seed,'quiet')};
  const still={sway:0,expansion:0,bloom:0,pulse:0};
  assert.deepEqual(flowerMotion(f,10,{responsive:true,dry:false},1,4,true),still);
  assert.deepEqual(flowerMotion(f,10,{responsive:false,dry:true},1,4),still);
  assert.equal(flowerMotion(f,10,{responsive:false,dry:false},1,4).expansion,0,'buds do not pulse or bloom before maturity');
});


test('flower heads lazily turn half forward, pause, and return a quarter without jumps', () => {
  const f={motion:{...flowerMotionProfile(seed,'turn'),spinPhase:0,spinDirection:1}};
  const m=f.motion,leg=m.spinDuration+m.spinPause,period=leg*2;
  assert.equal(flowerHeadTurn(f,0),0);
  assert.equal(flowerHeadTurn(f,m.spinDuration),180);
  assert.equal(flowerHeadTurn(f,leg),180);
  assert.equal(flowerHeadTurn(f,leg+m.spinDuration),90);
  assert.equal(flowerHeadTurn(f,period),90);
  assert.equal(flowerHeadTurn(f,period+m.spinDuration),270);
  for(let t=0;t<period*3;t+=.1)assert.ok(Math.abs(flowerHeadTurn(f,t+1/60)-flowerHeadTurn(f,t))<.6,'smooth rotation, including reversals and cycle boundaries');
  const reverse={motion:{...m,spinDirection:-1}};
  assert.equal(flowerHeadTurn(reverse,m.spinDuration),-180);
  const a=flowerHeadTurn({motion:flowerMotionProfile(seed,'one')},10);
  const b=flowerHeadTurn({motion:flowerMotionProfile(seed,'two')},10);
  assert.notEqual(a,b,'each flower has its own phase and speed');
});


test('flower appearance has stable varied greens, leaves, and circular/oval petals', () => {
  const appearances=Array.from({length:100},(_,i)=>flowerAppearance(seed,`appearance-${i}`));
  assert.deepEqual(appearances[0],flowerAppearance(seed,'appearance-0'));
  assert.notDeepEqual(appearances[0],flowerAppearance('another','appearance-0'));
  assert.ok(new Set(appearances.map(a=>a.stemColor)).size>30);
  assert.deepEqual([...new Set(appearances.map(a=>a.leaves.length))].sort(),[1,2,3,4]);
  assert.deepEqual([...new Set(appearances.map(a=>a.count))].sort(),[3,4,5,6,7,8,9]);
  assert.deepEqual([...new Set(appearances.map(a=>a.shape))].sort(),['circle','oval']);
  const leaves=appearances.flatMap(a=>a.leaves),petals=appearances.flatMap(a=>a.petals);
  assert.ok(new Set(leaves.map(l=>l.y)).size>100 && new Set(leaves.map(l=>l.rx)).size>100);
  assert.ok(leaves.some(l=>l.x<0)&&leaves.some(l=>l.x>0));
  assert.ok(new Set(appearances.map(a=>a.petals[0].radius)).size>90,'petal sizes vary between flowers');
  for(const a of appearances)assert.ok(a.petals.every(p=>JSON.stringify(p)===JSON.stringify(a.petals[0])),'petals within a flower are identical');
  assert.ok(petals.every(p=>p.offset+Math.max(p.radius,p.ry)<=.31));
});


test('butterfly weight bends a flower, then eases upright without moving its root', () => {
  const f=generateFlowerSites(seed,layout)[0],life=flowerLife(f,null,0);
  life.responsive=true;
  const load={value:0,target:1,at:0};
  assert.equal(flowerWeight(load,0),0);
  assert.ok(flowerWeight(load,.5)>.6 && flowerWeight(load,.5)<1);
  const loaded=flowerWeight(load,2),release={value:loaded,target:0,at:2};
  assert.ok(loaded>.98);
  assert.equal(flowerWeight(release,2),loaded,'takeoff starts from the current bend');
  assert.ok(flowerWeight(release,3)<loaded && flowerWeight(release,3)>.1);
  assert.ok(flowerWeight(release,9)<.002);
  const original=[f.x,f.y];
  const free=flowerPose(f,life,2,0,0,0),resting=flowerPose(f,life,2,0,0,loaded);
  assert.ok(Math.abs(resting.angle-free.angle)>1);
  assert.ok(resting.headOffset>free.headOffset,'head sinks under the butterfly');
  assert.notDeepEqual([resting.x,resting.y],[free.x,free.y]);
  assert.deepEqual([f.x,f.y],original,'root remains in stable world coordinates');
  assert.deepEqual(flowerPose(f,life,2,0,0,1,true),flowerPose(f,life,2,0,0,0,true),'reduced motion disables the decorative bend');
});


test('seeded flower postures follow 40/30/30 distribution and retain their bow while swaying',()=>{
  const counts={upright:0,left:0,right:0};
  for(let i=0;i<10000;i++){
    const p=flowerPosture(seed,`posture-${i}`);counts[p.kind]++;
    assert.deepEqual(p,flowerPosture(seed,`posture-${i}`));
  }
  assert.ok(Math.abs(counts.upright/10000-.4)<.02,JSON.stringify(counts));
  assert.ok(Math.abs(counts.left/10000-.3)<.02&&Math.abs(counts.right/10000-.3)<.02);
  const sites=generateFlowerSites(seed,layout),life={...flowerLife(sites[0],null,0),responsive:true};
  for(const kind of ['upright','left','right']){
    const f=sites.find(f=>f.posture.kind===kind);
    for(let seconds=0;seconds<30;seconds+=.25){
      const pose=flowerPose(f,life,seconds),still=flowerPose(f,life,seconds,0,0,0,true);
      assert.equal(pose.headX,f.posture.bow);
      assert.equal(still.headX,f.posture.bow,'reduced motion preserves resting posture');
      if(kind==='left')assert.ok(pose.x<f.x&&pose.headTilt<0);
      if(kind==='right')assert.ok(pose.x>f.x&&pose.headTilt>0);
      assert.ok(pose.growthScale<=life.growth,'bowed geometry remains within clearance envelope');
    }
    const wilted=flowerPose(f,{...life,dry:true,droop:28,growth:.38,responsive:false},30);
    if(kind==='left')assert.ok(wilted.x<f.x,'left bows wilt toward their resting side');
    if(kind==='right')assert.ok(wilted.x>f.x,'right bows wilt toward their resting side');
  }
});
