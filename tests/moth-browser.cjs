const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForSelector('.moth-head');
    const anatomy=await page.locator('.butterfly-body').evaluate(svg=>{
      const wings=[...svg.querySelectorAll('.moth-wing-shape')],spots=[...svg.querySelectorAll('.moth-eyespot')];
      const head=svg.querySelector('.moth-head'),body=svg.querySelector('.moth-abdomen'),antenna=svg.querySelector('.moth-antenna');
      const h=head.getBBox(),b=body.getBBox();
      return {wings:wings.length,pathsMatch:wings[0].getAttribute('d')===wings[1].getAttribute('d'),
        colors:wings.map(w=>w.getAttribute('fill')),spots:spots.map(s=>[s.tagName,s.getAttribute('fill'),+s.getAttribute('r')]),
        head:head.tagName,round:h.width===h.height,slender:b.height>b.width*3,
        outlines:svg.querySelectorAll('.butterfly-wing [stroke],.moth-head[stroke],.moth-abdomen[stroke]').length,
        antennae:(antenna.getAttribute('d').match(/M/g)||[]).length,roundedTips:antenna.getAttribute('stroke-linecap')==='round',
        images:svg.querySelectorAll('image').length};
    });
    assert.equal(anatomy.wings,2);assert.equal(anatomy.pathsMatch,true);
    assert.deepEqual(anatomy.colors,['#EBD3AB','#EBD3AB']);
    assert.deepEqual(anatomy.spots,[['circle','#BC8F3C',2.1],['circle','#BC8F3C',2.1]]);
    assert.equal(anatomy.head,'circle');assert.ok(anatomy.round&&anatomy.slender);
    assert.equal(anatomy.outlines,0);assert.equal(anatomy.antennae,2);assert.ok(anatomy.roundedTips);assert.equal(anatomy.images,0);
    const spreads=new Set();
    for(let i=0;i<12;i++){
      const result=await page.locator('.butterfly-body').evaluate(svg=>{
        const hinge=new DOMPoint(20,14.5).matrixTransform(svg.getScreenCTM());
        const wings=[...svg.querySelectorAll('.butterfly-wing')];
        const roots=wings.map(w=>{const p=new DOMPoint(20,14.5).matrixTransform(w.getScreenCTM());return Math.hypot(p.x-hinge.x,p.y-hinge.y);});
        const spots=[...svg.querySelectorAll('.moth-eyespot')].map(s=>new DOMPoint(+s.getAttribute('cx'),+s.getAttribute('cy')).matrixTransform(s.getScreenCTM()).matrixTransform(svg.getScreenCTM().inverse()));
        return {roots,symmetry:Math.abs(spots[0].x+spots[1].x-40)+Math.abs(spots[0].y-spots[1].y),spread:wings[0].getAttribute('transform')};
      });
      assert.ok(result.roots.every(d=>d<.05),'wings remain attached at their body hinges');
      assert.ok(result.symmetry<.01,'wings and eyespots remain symmetrical during flutter');
      spreads.add(result.spread);await page.waitForTimeout(90);
    }
    assert.ok(spreads.size>5,'multiple visible flutter positions');
    await page.screenshot({path:'/tmp/facefield-moth-6a.png'});
    const panels=await page.locator('.butterfly-body').evaluate(svg=>[1,.65,.3].map(spread=>{
      const clone=svg.cloneNode(true);clone.removeAttribute('style');clone.removeAttribute('class');
      clone.setAttribute('width','240');clone.setAttribute('height','240');
      clone.querySelectorAll('.butterfly-wing').forEach(w=>w.setAttribute('transform',`translate(20 0) scale(${spread} 1) translate(-20 0)`));
      return `<div>${new XMLSerializer().serializeToString(clone)}<p>${spread===1?'Open':spread===.65?'Mid-flutter':'Folded'}</p></div>`;
    }));
    const preview=await browser.newPage({viewport:{width:780,height:320}});
    await preview.setContent(`<style>body{margin:0;display:flex;justify-content:center;background:#F8F0E4;color:#8D7958;font:14px sans-serif}div{text-align:center;padding-top:20px}p{margin:0}</style>${panels.join('')}`);
    await preview.screenshot({path:'/tmp/facefield-moth-6a-flutter.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS Moth 6A: mirrored cream teardrop wings, two ochre eyespots, round head, tapered body, curved rounded antennae, outline-free SVG, attached symmetrical flutter hinges.');
  } finally {await browser.close();}
})();
