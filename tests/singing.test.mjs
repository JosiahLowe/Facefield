import test from 'node:test';
import assert from 'node:assert/strict';
import { MELODY, frequencyFor, VIBRATO, chooseSinger } from '../singing.js';

test('one short melody stays in C major and includes a breath', () => {
  assert.ok(MELODY.length < 12);
  assert.ok(MELODY.some(n=>n.midi===null));
  assert.ok(MELODY.reduce((sum,n)=>sum+n.duration,0) >= 8);
  for(const n of MELODY) {
    assert.ok(n.duration>=.7);
    if(n.midi!==null)assert.ok([60,62,64,65,67,69,71,72].includes(n.midi));
  }
  assert.equal(frequencyFor(69),440);
  assert.ok(Math.abs(frequencyFor(60)-261.625565)<.001);
});

test('vibrato stays restrained and singer changes exclude the current face', () => {
  assert.ok(VIBRATO.rate >= 4 && VIBRATO.rate <= 6);
  assert.ok(VIBRATO.depth > 0 && VIBRATO.depth <= 20);
  const faces = [0, 1, 2, 3];
  const choices = new Set();
  for(let i=0;i<100;i++) {
    const choice = chooseSinger(faces, 1, () => i/100);
    assert.notEqual(choice,1);choices.add(choice);
  }
  assert.deepEqual([...choices].sort(),[0,2,3]);
  assert.equal(chooseSinger([1],1),1);
});
