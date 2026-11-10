const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.FACEFIELD_URL || 'http://127.0.0.1:8000/')+'?seed=facefield');await page.waitForSelector('.face');
const read=()=>page.locator('svg > path:not([data-feature]):not([data-animation])').evaluateAll(ps=>ps.map(p=>p.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number)));
const before=await read(),url=page.url();await page.locator('#test-mouths').click();await page.waitForTimeout(1000);
const changed=await read();assert.equal(await page.locator('#test-mouths').getAttribute('aria-pressed'),'true');
for(let i=0;i<36;i++){const rest=before[i][3]-before[i][1],next=changed[i][3]-before[i][1];assert.ok(rest ? Math.sign(next)===-Math.sign(rest) : Math.abs(next)>=12,'visible expression switches');}
for(let i=40;i<192;i++)assert.deepEqual(changed[i],before[i]);assert.equal(page.url(),url);

await page.locator('#test-mouths').click();await page.waitForTimeout(1000);assert.deepEqual(await read(),before);
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(600);await page.locator('#test-mouths').click();
assert.ok(Math.abs((await read())[0][3]-before[0][3])>7.9);const still=await read();await page.waitForTimeout(250);assert.deepEqual(await read(),still);
await page.locator('#test-mouths').click();assert.deepEqual(await read(),before);
await page.setViewportSize({width:320,height:568});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
const control=await page.locator('.controls').boundingBox();assert.ok(control.x>=0&&control.x+control.width<=320);
await page.locator('#test-mouths').click();await page.locator('#shuffle').click();assert.equal(await page.locator('#test-mouths').getAttribute('aria-pressed'),'false');
assert.deepEqual(errors,[]);console.log('PASS mouth test button: visible faces change, reset restores, offscreen faces unchanged, seed preserved, reduced motion static, fits 320px, shuffle resets state.');await browser.close();})();
