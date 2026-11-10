import test from 'node:test';
import assert from 'node:assert/strict';
import { personality, gazeOffset } from '../behavior.js';

test('personalities reproduce from seed, tile, and revision with all five profiles', () => {
  const names = new Set();
  for (let i = 0; i < 500; i++) {
    const p = personality('wall', i, 2);
    assert.deepEqual(p, personality('wall', i, 2));
    assert.ok(p.gaze[0] > p.move && p.gaze[1] > p.gaze[0]);
    assert.ok(p.blink >= 100 && p.blink <= 200);
    names.add(p.name);
  }
  assert.equal(names.size, 5);
  assert.notDeepEqual(personality('wall', 0), personality('new', 0));
});

test('gaze targets remain safely within available pupil travel', () => {
  for (let i = 0; i < 1000; i++) {
    const offset = gazeOffset(i / 100, i / 500);
    assert.ok(Math.hypot(...offset) <= .880000001);
  }
  assert.deepEqual(gazeOffset(0, 0), [0, 0]);
});

test('mouth targets choose a different neutral, smiling, or frowning expression', async () => {
  const { mouthTarget } = await import('../behavior.js');
  const { randomFrom } = await import('../faces.js');
  const random = randomFrom('mouth-check');
  let asymmetry = 0;
  const transitions = new Set();
  for (const name of ['curious', 'sleepy', 'nervous', 'calm', 'observant']) {
    for (const rest of [-12, -7, 0, 9, 17]) {
      for (let i = 0; i < 500; i++) {
        const target = mouthTarget(rest, name, random);
        assert.ok(target.bend === 0 || (Math.abs(target.bend) >= 8 && Math.abs(target.bend) <= 16));
        assert.ok(Math.abs(target.corner) <= .77);
        assert.notEqual(Math.sign(target.bend), Math.sign(rest));
        transitions.add(`${Math.sign(rest)}:${Math.sign(target.bend)}`);
        if (name === 'sleepy') assert.ok(Math.abs(target.bend) <= 10);
        if (target.corner) asymmetry++;
      }
    }
  }
  assert.ok(asymmetry > 0);
  assert.equal(transitions.size, 6);
});
