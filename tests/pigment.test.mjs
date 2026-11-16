import test from 'node:test';
import assert from 'node:assert/strict';
import {pigmentLevel,depositPigment,pigmentColor,facePigmentColor,RESTING_FACE_SATURATION} from '../pigment.js';
test('pigment builds gradually, holds longer than blush and fades away',()=>{
 assert.equal(pigmentLevel(null,1000),0);
 const trace=depositPigment(null,1,100,100);
 assert.ok(trace.value>0&&trace.value<1);
 assert.equal(pigmentLevel(trace,20100),trace.value);
 assert.ok(pigmentLevel(trace,35100)<trace.value&&pigmentLevel(trace,35100)>0);
 assert.equal(pigmentLevel(trace,50100),0);
});
test('returning moth refreshes pigment without a snap; offscreen decay uses elapsed world time',()=>{
 const a=depositPigment(null,1,100,500),b=depositPigment(a,1,10000,100);
 assert.ok(b.value>a.value&&b.value<1);assert.equal(pigmentLevel(b,30000),b.value);
 assert.equal(pigmentLevel(b,60000),0);assert.equal(depositPigment(b,0,70000,100),b);
 assert.equal(pigmentLevel(a,35000),pigmentLevel({...a},35000));
});

import {PALETTE,contrastRatio} from '../palette.js';
test('saturation reveals seeded colors from grayscale without whitening their values',()=>{
 for(const color of PALETTE.skin){
  const gray=pigmentColor(color,0),channels=gray.slice(1).match(/../g).map(v=>parseInt(v,16));
  assert.equal(channels[0],channels[1]);assert.equal(channels[1],channels[2]);assert.notEqual(gray,'#FFFFFF');
  assert.equal(pigmentColor(color,1),color);
  const value=c=>(contrastRatio(c,'#000000')-1)*.05;
  for(const amount of [0,.25,.5,.75,1])assert.ok(Math.abs(value(pigmentColor(color,amount))-value(color))<.004,'value should stay stable while saturation returns');
 }
});

test('resting faces retain a hint of color while moth pigment restores full saturation',()=>{
 assert.equal(RESTING_FACE_SATURATION,.30);
 for(const color of PALETTE.skin){
  assert.equal(facePigmentColor(color,0),pigmentColor(color,.30));
  assert.notEqual(facePigmentColor(color,0),pigmentColor(color,0));
  assert.equal(facePigmentColor(color,1),color);
  assert.notEqual(facePigmentColor(color,.5),facePigmentColor(color,0));
 }
});
