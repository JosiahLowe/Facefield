import test from 'node:test';
import assert from 'node:assert/strict';
import { MELODY, frequencyFor } from '../singing.js';

test('one short melody stays in C major and includes a breath', () => {
  assert.ok(MELODY.length < 12);
  assert.ok(MELODY.some(n=>n.midi===null));
  assert.ok(MELODY.reduce((sum,n)=>sum+n.duration,0) >= 4);
  for(const n of MELODY) {
    assert.ok(n.duration>=.3);
    if(n.midi!==null)assert.ok([60,62,64,65,67,69,71,72].includes(n.midi));
  }
  assert.equal(frequencyFor(69),440);
  assert.ok(Math.abs(frequencyFor(60)-261.625565)<.001);
});
