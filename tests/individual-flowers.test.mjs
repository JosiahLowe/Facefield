import test from 'node:test';
import assert from 'node:assert/strict';
import {flowerAppearance} from '../flowers.js';
import {renderFace} from '../faces.js';
import {mixColor} from '../palette.js';
import {individualFlowerStyle,individualFlowerGeometry,stickerShadowOffset,INDIVIDUAL_FLOWER_COLORS,INDIVIDUAL_FLOWER_CENTERS,INDIVIDUAL_FLOWER_GREENS,INDIVIDUAL_FLOWER_DRIED} from '../individual-flowers.js';
const fixture=i=>({id:`single-${i}`,phase:i*.193,appearance:flowerAppearance('sticker',`single-${i}`)});
test('individual flowers retain stable shapes and cool palettes without multi-bloom clusters',()=>{
 const forms=new Set();for(let i=0;i<160;i++){
  const f=fixture(i),s=individualFlowerStyle(f);assert.deepEqual(s,individualFlowerStyle(f));forms.add(s.form);
  assert.ok(INDIVIDUAL_FLOWER_COLORS.includes(s.color));assert.ok(INDIVIDUAL_FLOWER_CENTERS.includes(s.center));assert.ok(INDIVIDUAL_FLOWER_GREENS.includes(s.green));
  const svg=individualFlowerGeometry(f,`test-${i}`);
  assert.equal((svg.match(/class="flower-head"/g)||[]).length,1);assert.equal((svg.match(/class="flower-stem-path"/g)||[]).length,1);
  assert.ok(!svg.includes('flower-group'));assert.ok(!svg.includes('<filter'));
 }assert.deepEqual([...forms].sort(),['bell','cone','daisy','ray']);
});
test('every sticker shadow shares the live stem, leaves, petals and center geometry',()=>{
 for(let i=0;i<24;i++){
  const svg=individualFlowerGeometry(fixture(i),`shared-${i}`);
  const ids=[...svg.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,3);
  for(const id of ids){assert.equal([...svg.matchAll(/ href="([^"]+)"/g)].filter(m=>m[1]===`#${id}`).length,2,'one colored use and one silhouette use');}
  const shadow=svg.slice(svg.indexOf('<g class="flower-sticker-shadow"'),svg.indexOf('<g class="flower-stem"'));
  assert.equal((shadow.match(/<use /g)||[]).length,3);assert.ok(shadow.includes('opacity=".24"'));
  assert.ok(svg.includes('class="flower-leaves"'));assert.ok(svg.includes('stroke="inherit"'),'stem takes color from its colored/shadow use');
 }
});
test('sticker offset stays down-right in world coordinates during sway and wilt',()=>{
 for(const angle of [-55,-30,-8,0,8,30,55]){
  const p=stickerShadowOffset(angle),r=angle*Math.PI/180;
  assert.ok(Math.abs(Math.cos(r)*p.x-Math.sin(r)*p.y-.08)<1e-12);
  assert.ok(Math.abs(Math.sin(r)*p.x+Math.cos(r)*p.y-.08)<1e-12);
 }
});
test('flower paints remain distinct from sampled white-to-pigmented face colors',()=>{
 const rgb=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16));
 const colors=[...INDIVIDUAL_FLOWER_COLORS,...INDIVIDUAL_FLOWER_CENTERS,...INDIVIDUAL_FLOWER_GREENS,INDIVIDUAL_FLOWER_DRIED].map(rgb);
 for(let i=0;i<180;i++){
  const f=renderFace('facefield',i),paints=[f.color,...[...f.svg.matchAll(/stop-color="(#[A-Fa-f0-9]+)"/g)].map(m=>m[1])];
  for(const paint of paints)for(let step=0;step<=20;step++){
   const face=rgb(mixColor('#FFFFFF',paint,step/20));
   for(const flower of colors)assert.ok(Math.hypot(...flower.map((v,j)=>v-face[j]))>45,'flower color is too close to a face pigment');
  }
 }
});
