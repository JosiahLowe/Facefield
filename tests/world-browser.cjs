const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.FACEFIELD_URL || 'http://127.0.0.1:8000/') + '?seed=facefield');
  await page.waitForSelector('.face svg');
  await page.waitForFunction(() => document.querySelector('#world').scrollTop > 0);
  const size = await page.evaluate(() => {
    const w = document.querySelector('#world');
    return { width: innerWidth, height: innerHeight, worldWidth: w.scrollWidth, worldHeight: w.scrollHeight,
      x: w.scrollLeft, y: w.scrollTop, tile: document.querySelector('.face').getBoundingClientRect().width };
  });
  assert.ok(await page.locator('link[rel=stylesheet]').getAttribute('href').then(href=>href.includes('?v=')), 'world stylesheet must bypass the old cached layout');
  assert.equal(size.width,390); assert.equal(size.height,844);
  assert.equal(size.worldWidth,4680); assert.equal(size.worldHeight,4680);
  assert.ok(size.x>390 && size.worldWidth-size.x-390>390);
  assert.ok(size.y>844 && size.worldHeight-size.y-844>844);
  assert.ok(size.tile===97.5 || size.tile===195, 'existing tile scale preserved');
  assert.equal(await page.locator('.face').count(),1152);
  const before = await page.locator('.face').evaluateAll(ts => ts.map(t => t.innerHTML));
  const url = page.url();
  // Actual browser touch input: horizontal and vertical swipes in both directions.
  const client = await page.context().newCDPSession(page);
  async function swipe(dx,dy) {
    const original = await page.locator('#world').evaluate(w => [w.scrollLeft,w.scrollTop]);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:400}]});
    for(let i=1;i<=10;i++) {
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195+dx*i/10,y:400+dy*i/10}]});
      await page.waitForTimeout(20);
    }
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(350);
    const next=await page.locator('#world').evaluate(w=>[w.scrollLeft,w.scrollTop]);
    assert.ok(dx ? (next[0]-original[0])*dx<0 : (next[1]-original[1])*dy<0, 'swipe scrolls naturally');
  }
  await swipe(-120,0); await swipe(120,0); await swipe(0,-180); await swipe(0,180);
  async function pinch(startHalf, endHalf) {
    const points=half=>[{x:195-half,y:400,id:0},{x:195+half,y:400,id:1}];
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(startHalf)});
    for(let i=1;i<=12;i++) {
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(startHalf+(endHalf-startHalf)*i/12)});
      await page.waitForTimeout(30);
    }
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(300);
  }
  await pinch(70,160);
  assert.ok(await page.evaluate(()=>visualViewport.scale)>1.1, 'zooming in remains available');
  await pinch(160,20);
  const scale=await page.evaluate(()=>visualViewport.scale);
  assert.ok(scale>=.999 && scale<=1.001, 'zooming out stops at normal scale');
  assert.equal(page.url(),url, 'swiping must not regenerate a face');
  assert.deepEqual(await page.locator('.face').evaluateAll(ts=>ts.map(t=>t.innerHTML)),before);
  const index=await page.locator('.face').evaluateAll(ts=>ts.findIndex(t=>{
    const r=t.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<innerHeight-80;
  }));
  assert.ok(index>=0);await page.locator('.face').nth(index).tap();
  assert.equal(await page.locator('.face').nth(index).innerHTML(),before[index]);
  const state=await page.locator('#grid').innerHTML();await page.reload();await page.waitForSelector('.face');
  assert.equal(await page.locator('#grid').innerHTML(),state, 'seed and tile revisions reproduce the larger world');
  assert.deepEqual(errors,[]);
  console.log('PASS world browser: iPhone viewport stays 390x844; 4680x4680 square world starts centered; pinch-out restricted at 1x; four-direction touch scrolling; no tap regeneration on swipes; unchanged face scale; inert face taps; seeded reload.');
  await browser.close();
})();
