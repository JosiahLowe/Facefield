import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdTraits,crowdLayout,crowdDecorations,CROWD_PALETTE} from '../crowd-art.js';
import {mosaicLayout} from '../mosaic.js';
test('crowd presentation preserves all stable model identities in staggered bounded slots',()=>{
 const model=mosaicLayout('crowd',48,1152),before=JSON.stringify(model),a=crowdLayout(model);
 assert.deepEqual(a,crowdLayout(model));assert.equal(JSON.stringify(model),before);assert.equal(a.length,1152);
 assert.equal(new Set(a.map(c=>`${c.column}:${c.row}`)).size,1152);
 for(const c of a){assert.ok(c.column>=1&&c.column-1+c.width<=48);assert.ok(c.row>=1&&c.row-1+c.height<=48.00001);}
 assert.equal(new Set(a.map(c=>c.row)).size,36);
});
test('crowd traits use independent deterministic variation and the coordinated palette',()=>{
 const styles=new Set(),eyes=new Set();for(let i=0;i<1152;i++){
 const a=crowdTraits('crowd',i);assert.deepEqual(a,crowdTraits('crowd',i));assert.notDeepEqual(a,crowdTraits('other',i));
 assert.ok(CROWD_PALETTE.skin.includes(a.skin));assert.ok(CROWD_PALETTE.hair.includes(a.hair));styles.add(a.style);eyes.add(a.eyes);
 }assert.equal(styles.size,6);assert.equal(eyes.size,2);
});

test('refined crowd has narrower heads, larger eyes, varied facing and white oval bodies without permanent blush',()=>{
 const directions=new Set();for(let i=0;i<200;i++){
  const t=crowdTraits('refinement',i);assert.ok(t.rx>=27&&t.rx<31);assert.ok(t.eyeScale>=.30&&t.eyeScale<.345);
  directions.add(t.facing< -2?'left':t.facing>2?'right':'front');
  const svg=crowdDecorations(t,`test-${i}`);assert.match(svg,/data-crowd-torso[^>]+ry="75" fill="#FFFFFF"/);assert.ok(!svg.includes('data-crowd-base-cheek'));
 }assert.equal(directions.size,3);
});

test('reference hairstyles are complete silhouettes behind the peach head',()=>{
 for(let i=0;i<120;i++){
  const svg=crowdDecorations(crowdTraits('hair-layers',i),`layer-${i}`);
  const head=svg.slice(svg.indexOf('<g data-crowd-decoration data-crowd-head>'));
  assert.equal([...head.matchAll(/<path /g)].length,1,'one rear silhouette, no front hair cap');
  assert.ok(head.indexOf('data-crowd-hair')<head.indexOf('data-crowd-head-shape'));
  const path=head.match(/data-crowd-hair d="([^"]+)"/)[1];
  assert.equal([...path.matchAll(/M/g)].length,1);assert.ok(path.endsWith('Z'));
 }
});

test('Crowd favors simple cropped cuts and has a broad stable range of skin tones',()=>{
 const people=Array.from({length:1152},(_,i)=>crowdTraits('crowd-crops',i));
 const crops=people.filter(p=>['cropped','close-cropped'].includes(p.hairKind)).length;
 const curls=people.filter(p=>p.hairKind==='curly').length;
 assert.ok(crops>people.length*.5&&crops<people.length*.7,'short crops should be the dominant hairstyle');
 assert.ok(curls>0&&curls<people.length*.15,'curly silhouettes should be occasional');
 assert.equal(new Set(people.map(p=>p.skin)).size,CROWD_PALETTE.skin.length);assert.ok(CROWD_PALETTE.skin.length>=8);
 const brightness=CROWD_PALETTE.skin.map(c=>c.slice(1).match(/../g).map(v=>parseInt(v,16)).reduce((s,v)=>s+v,0)/3);
 assert.ok(Math.max(...brightness)-Math.min(...brightness)>140,'skin values should span light through deep tones');
});
