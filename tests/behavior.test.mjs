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

test('neutral is guaranteed within two expressive targets and has a distinct rest', async () => {
  const { mouthTarget, mouthPause } = await import('../behavior.js');
  for (const name of ['curious', 'sleepy', 'nervous', 'calm', 'observant']) {
    // Choose random values that would otherwise repeatedly avoid neutral.
    let bend = 12, expressive = 0, neutralCount = 0;
    for (let i = 0; i < 20; i++) {
      const target = mouthTarget(bend, name, () => .99, expressive >= 1);
      bend = target.bend;
      expressive = bend === 0 ? 0 : expressive + 1;
      assert.ok(expressive <= 1);
      if (bend === 0) {
        neutralCount++;
        assert.equal(target.corner, 0);
        assert.ok(mouthPause(name, true, () => 0) >= 4000);
      }
    }
    assert.ok(neutralCount >= 9);
  }
});

test('fly attention fades smoothly at the configurable world-space radius', async () => {
  const {flyAttention}=await import('../behavior.js');
  assert.equal(flyAttention(0,0,200),1);
  assert.equal(flyAttention(200,0,200),0);
  assert.equal(flyAttention(201,0,200),0);
  assert.equal(flyAttention(100,0,200),.5);
  assert.equal(flyAttention(60,80,200),flyAttention(100,0,200));
  assert.ok(flyAttention(199,0,200)<.0001);
  assert.ok(flyAttention(60,0,200)>flyAttention(160,0,200));
});
test('tracking offsets stay in the eye circle and keep pupils exposed under either lid', async () => {
  const {constrainGaze}=await import('../behavior.js');
  for(let i=0;i<1000;i++){
    const offset=constrainGaze([Math.sin(i)*2,Math.cos(i)*2],-.42,.53);
    assert.ok(Math.hypot(...offset)<=.880000001);
    assert.ok(offset[1]>=-.42&&offset[1]<=.53);
  }
});
