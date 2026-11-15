import test from 'node:test';
import assert from 'node:assert/strict';
import {pigmentLevel,depositPigment} from '../pigment.js';
test('pigment starts white, builds gradually, holds longer than blush and fades to white',()=>{
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
