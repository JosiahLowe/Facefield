const assert=require('node:assert/strict'),audioSpy=require('./audio-spy.cjs');
module.exports={
 async setup(browser,options={}){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,...options});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.addInitScript(audioSpy);await page.addInitScript(()=>{Math.random=()=>.4;});
  await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
  return {page,errors};
 },
 async start(page){
  await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(100);
  return page.evaluate(()=>{
   const w=document.querySelector('#world'),b=document.querySelector('.butterfly'),before=[+b.dataset.worldX,+b.dataset.worldY];
   document.querySelector('#kill-moth').click();return {singer:document.querySelector('[data-singer]').dataset.index,before,after:[+b.dataset.worldX,+b.dataset.worldY],camera:[w.scrollLeft,w.scrollTop]};
  });
 },
 state:page=>page.locator('#world').getAttribute('data-moth-story'),
 async until(page,predicate,limit=180,step=1000){
  for(let i=0;i<limit;i++){if(await page.evaluate(predicate))return;await page.clock.runFor(step);}assert.fail('story condition not reached');
 },
 async move(page,selector='[data-singer]'){
  return page.locator(selector).evaluate(t=>{const w=document.querySelector('#world');w.scrollTo(t.offsetLeft+t.offsetWidth/2-w.clientWidth/2,t.offsetTop+t.offsetHeight/2-w.clientHeight/2);return [w.scrollLeft,w.scrollTop];});
 },
 async arrive(page){
  await module.exports.move(page);
  await module.exports.until(page,()=>{const b=document.querySelector('.butterfly');return b.dataset.singerIndex===document.querySelector('[data-singer]').dataset.index&&!b.dataset.pendingSinger&&['approach','hover','landing','landed','takeoff'].includes(b.dataset.mode);});
  await page.clock.runFor(400);
  assert.equal(await module.exports.state(page),'chorus_active');
 },
 async investigate(page){await module.exports.move(page,'[data-chorus-voice="1"]');await page.clock.runFor(100);},
 async die(page){
  await module.exports.investigate(page);
  await module.exports.until(page,()=>document.querySelector('#world').dataset.mothStory==='crying',100,50);
 },
};
