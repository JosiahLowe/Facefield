const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:600,height:450}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const base=process.env.FACEFIELD_URL||'http://127.0.0.1:8000/';
    await page.route('**/reaction-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><style>
      body{margin:0}#world{position:fixed;inset:0;overflow:scroll}#extent{width:2000px;height:1200px;pointer-events:none}
      #grid{position:absolute;left:600px;top:100px;width:360px;height:120px;display:grid;grid-template-columns:repeat(3,120px)}
      .face{padding:0;border:0;width:120px;height:120px}svg{display:block;width:100%;height:100%}
      </style><div id="world"><div id="extent"></div><div id="grid"></div></div><script type="module">
      import {renderFace} from './faces.js';import {animateFaces} from './behavior.js';
      window.mothPoint=null;
      const grid=document.querySelector('#grid');window.reactions=animateFaces(grid,null,()=>window.mothPoint);
      for(let i=0;i<3;i++){const t=document.createElement('div');t.className='face';t.innerHTML=renderFace('moth-reaction',i).svg;grid.append(t);reactions.register(t,'moth-reaction',i,0);}
      document.querySelector('#world').scrollTo(500,0);window.ready=true;
      </script>`}));
    await page.goto(base+'reaction-fixture');await page.waitForFunction(()=>window.ready);
    const read=()=>page.locator('.face').evaluateAll(ts=>ts.map(t=>{
      const p=t.querySelector('[data-feature=mouth]').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
      return {bend:p[3]-(p[1]+p[5])/2,blush:+t.querySelector('[data-feature=cheeks]').getAttribute('opacity'),
        pupil:+t.querySelectorAll('circle')[1].getAttribute('cx'),open:t.querySelector('[data-feature=mouth]').getAttribute('fill')!=='none'};
    }));
    await page.waitForTimeout(250);
    const initial=await read();assert.ok(initial.every(f=>f.bend<=0&&f.blush===0));
    const center=await page.locator('.face').first().evaluate(t=>{
      const e=t.querySelector('circle'),w=document.querySelector('#world');
      const p=new DOMPoint(50,+e.getAttribute('cy')).matrixTransform(e.getScreenCTM());
      return {x:p.x+w.scrollLeft,y:p.y+w.scrollTop};
    });
    await page.evaluate(c=>{window.mothPoint={x:c.x-240,y:c.y};},center);await page.waitForTimeout(700);
    let faces=await read();
    assert.ok(faces[0].bend>3&&faces[0].blush===0,'smiling and looking at 240px do not cause distant blush');
    assert.ok(faces[0].pupil<initial[0].pupil,'eyes track within the restored looking range');
    assert.ok(faces.slice(1).every(f=>f.bend<=0&&f.blush===0),'outside-range faces never smile or blush');
    await page.evaluate(c=>{window.mothPoint={x:c.x-100,y:c.y};},center);await page.waitForTimeout(700);
    assert.ok((await read())[0].blush>.15,'blush appears only at close range');
    await page.evaluate(c=>{window.mothPoint={x:c.x-240,y:c.y};},center);await page.waitForTimeout(100);
    assert.equal((await read())[0].blush,0,'blush disappears outside its own smaller radius');
    assert.ok((await read())[0].bend>0,'smile remains within the larger looking radius');
    await page.evaluate(c=>{window.mothPoint={x:c.x-450,y:c.y};},center);await page.waitForTimeout(100);
    assert.ok((await read()).every(f=>f.bend<=0&&f.blush===0),'no smile or rosy cheeks linger beyond looking proximity');
    for(let i=0;i<12;i++){await page.waitForTimeout(100);assert.ok((await read()).every(f=>f.bend<=0&&f.blush===0));}
    await page.evaluate(c=>{window.mothPoint=c;},center);await page.waitForTimeout(750);
    faces=await read();assert.ok(faces[0].bend>8&&faces[0].blush>.40&&faces[0].blush<=.48);
    await page.evaluate(()=>reactions.setSingingMouth(document.querySelector('.face'),.9));
    assert.equal((await read())[0].open,true,'singing mouth animation takes priority');
    await page.evaluate(()=>reactions.setSingingMouth(document.querySelector('.face'),0));
    assert.ok((await read())[0].bend>0,'singer returns to a proximity smile between notes');
    await page.evaluate(()=>reactions.setSingingMouth(document.querySelector('.face'),null));
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
    const still=await page.locator('#grid').innerHTML();await page.waitForTimeout(600);
    assert.equal(await page.locator('#grid').innerHTML(),still,'reduced motion keeps a static proximity reaction');
    assert.ok((await read())[0].bend>0&&(await read())[0].blush>.40&&(await read())[0].blush<=.48);
    await page.evaluate(c=>{window.mothPoint={x:c.x-450,y:c.y};},center);await page.waitForTimeout(600);
    assert.ok((await read()).every(f=>f.bend<=0&&f.blush===0));
    assert.equal(await page.locator('[data-feature=cheek]').count(),6);
    assert.ok(await page.locator('[data-feature=cheek]').evaluateAll(es=>es.every(e=>{
      const b=e.getBoundingClientRect(),frame=e.closest('.face').getBoundingClientRect();
      return Math.abs(b.width-b.height)<.01&&b.left>=frame.left&&b.right<=frame.right&&b.top>=frame.top&&b.bottom<=frame.bottom;
    })),'round cheeks remain inside every face frame');
    assert.deepEqual(errors,[]);
    console.log('PASS moth reactions: neutral/frowning idle faces, 320px looking/smiling range, separate 160px blush range, larger, stronger circular cheeks within the face frame, singing priority and static reduced-motion reactions.');
  } finally {await browser.close();}
})();
