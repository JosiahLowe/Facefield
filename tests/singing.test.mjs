import test from 'node:test';
import assert from 'node:assert/strict';
import { MELODY, frequencyFor, VIBRATO, chooseSinger, chooseSong } from '../singing.js';

test('long melody stays in C major and includes sustained notes and breaths', () => {
  assert.ok(MELODY.length >= 15);
  assert.ok(MELODY.some(n=>n.midi===null));
  assert.ok(MELODY.reduce((sum,n)=>sum+n.duration,0) >= 30);
  for(const n of MELODY) {
    assert.ok(n.duration>=.7);
    if(n.midi!==null)assert.ok([60,62,64,65,67,69,71,72].includes(n.midi));
  }
  assert.equal(frequencyFor(69),440);
  assert.ok(Math.abs(frequencyFor(60)-261.625565)<.001);
});

test('vibrato stays restrained and singer changes exclude the current face', () => {
  assert.ok(VIBRATO.rate >= 4 && VIBRATO.rate <= 6);
  assert.ok(VIBRATO.depth > 0 && VIBRATO.depth <= 40);
  const faces = [0, 1, 2, 3];
  const choices = new Set();
  for(let i=0;i<100;i++) {
    const choice = chooseSinger(faces, 1, () => i/100);
    assert.notEqual(choice,1);choices.add(choice);
  }
  assert.deepEqual([...choices].sort(),[0,2,3]);
  assert.equal(chooseSinger([1],1),1);
});

test('distance attenuation is bounded, monotonic and retains distant audibility', async () => {
  const { distanceVolume } = await import('../singing.js');
  for(const diagonal of [500,930,1800]) {
    assert.equal(distanceVolume(0,diagonal),.25);
    assert.equal(distanceVolume(diagonal*.1,diagonal),.25);
    let previous=.25;
    for(let i=1;i<=100;i++) {
      const gain=distanceVolume(i*diagonal/10,diagonal);
      assert.ok(gain<=previous && gain>.02 && gain<=.25);
      previous=gain;
    }
    assert.ok(distanceVolume(10*diagonal,diagonal)<.022);
  }
});

test('horizontal panning is centered, symmetric, gradual and never hard-separated', async () => {
  const { horizontalPan } = await import('../singing.js');
  for(const width of [320,390,1440]) {
    assert.equal(horizontalPan(0,width),0);
    let previous=0;
    for(let i=1;i<=100;i++) {
      const pan=horizontalPan(i*width/20,width);
      assert.ok(pan>previous&&pan<=.65);
      assert.ok(Math.abs(pan+horizontalPan(-i*width/20,width))<1e-12);
      previous=pan;
    }
    assert.ok(horizontalPan(width,width)>.5);
  }
});

test('every singer handoff changes key and melodic pattern', () => {
  let song=chooseSong(null,()=>0);
  for(let i=0;i<100;i++){
    const next=chooseSong(song,()=>i/100);
    assert.notEqual(next.root,song.root);assert.notEqual(next.pattern,song.pattern);
    assert.ok(next.melody.reduce((sum,n)=>sum+n.duration,0)>30);
    const sung=next.melody.filter(n=>n.midi!==null);
    assert.ok(sung.every(n=>n.duration>=1.8));
    assert.ok(sung.filter(n=>n.duration>=2.5).length>=6);
    song=next;
  }
});
