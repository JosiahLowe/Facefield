const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
    assert.equal(await page.locator('button:not(.face)').count(),1,'sound is the only control');
    assert.equal(await page.locator('#seed,#shuffle,#test-mouths,#change-singer,.instructions').count(),0);
    assert.equal(await page.locator('#enable-sound').innerText(),'Enable Sound');
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:844});await page.waitForTimeout(150);
      const result=await page.evaluate(()=>{
        const tiles=[...document.querySelectorAll('.face')];
        const square=tiles.every(t=>+t.querySelector('[data-feature=skin]').getAttribute('rx')===0&&getComputedStyle(t).borderRadius==='0px');
        let covered=true;
        for(let y=0;y<innerHeight;y+=19)for(let x=0;x<innerWidth;x+=17){
          const hit=document.elementFromPoint(x,y);
          if(!hit?.closest('.face,.sound-control'))covered=false;
        }
        const sound=document.querySelector('#enable-sound').getBoundingClientRect();
        return {square,covered,soundFits:sound.left>=0&&sound.right<=innerWidth};
      });
      assert.deepEqual(result,{square:true,covered:true,soundFits:true},`${width}px viewport`);
    }
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
    await page.locator('#enable-sound').tap();
    await page.waitForFunction(()=>document.querySelector('#enable-sound').getAttribute('aria-pressed')==='true');
    assert.equal(await page.locator('#enable-sound').innerText(),'Mute Sound');
    await page.locator('#enable-sound').tap();
    assert.equal(await page.locator('#enable-sound').getAttribute('aria-pressed'),'false');
    await page.locator('[data-singer]').scrollIntoViewIfNeeded();
    const previous=await page.locator('[data-singer]').getAttribute('data-index');
    const extent=await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]);
    await page.locator('[data-singer]').tap();
    assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),previous,'tapping the singer still advances');
    assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]),extent);
    assert.equal(await page.locator('.face').count(),1152);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/tmp/facefield-square-minimal.png'});
    console.log('PASS minimal controls: square faces cover viewport, only sound control, mute/unmute and tap-to-advance at mobile/desktop widths.');
  } finally { await browser.close(); }
})();
