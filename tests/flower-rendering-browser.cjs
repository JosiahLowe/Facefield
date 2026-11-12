const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const engine=process.env.FACEFIELD_BROWSER==='webkit' ? webkit : chromium;
  const browser=await engine.launch(engine===chromium
    ? {executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']} : {});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForSelector('.flower[data-stage=bloom]');
    const result=await page.evaluate(async()=>{
      const flowers=[...document.querySelectorAll('.flower[data-stage=bloom]')];
      const original=flowers.sort((a,b)=>+b.getAttribute('transform').match(/scale\(([\d.]+)/)[1]-+a.getAttribute('transform').match(/scale\(([\d.]+)/)[1])[0];
      const ns='http://www.w3.org/2000/svg';
      const green=original.querySelector('.flower-stem').getAttribute('fill').slice(1).match(/../g).map(c=>parseInt(c,16));
      async function paint(shadows){
        const svg=document.createElementNS(ns,'svg');
        svg.setAttribute('width','128');svg.setAttribute('height','128');
        svg.setAttribute('viewBox','0 0 128 128');
        const flower=original.cloneNode(true);
        flower.setAttribute('transform','translate(64 100) scale(80)');
        flower.setAttribute('opacity','1');
        if(!shadows)flower.querySelectorAll('.flower-head-shadow,.flower-leaf-shadow').forEach(el=>el.remove());
        svg.append(flower);
        const image=new Image();
        image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
        await image.decode();
        const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
        const context=canvas.getContext('2d');context.fillStyle='#607050';context.fillRect(0,0,128,128);
        context.drawImage(image,0,0);
        return context.getImageData(0,0,128,128).data;
      }
      const withShadow=await paint(true),withoutShadow=await paint(false);
      let whitePixels=0,shadowPixels=0,leafPixels=0,yellowPixels=0,wx=0,wy=0,sx=0,sy=0;
      for(let i=0;i<withShadow.length;i+=4){
        if(withShadow[i]>245&&withShadow[i+1]>245&&withShadow[i+2]>245){whitePixels++;wx+=(i/4)%128;wy+=Math.floor(i/4/128);}
        if(withShadow[i]+withShadow[i+1]+withShadow[i+2]+8<withoutShadow[i]+withoutShadow[i+1]+withoutShadow[i+2]){shadowPixels++;sx+=(i/4)%128;sy+=Math.floor(i/4/128);}
        if(Math.abs(withShadow[i]-green[0])<3&&Math.abs(withShadow[i+1]-green[1])<3&&Math.abs(withShadow[i+2]-green[2])<3)leafPixels++;
        if(Math.abs(withShadow[i]-208)<3&&Math.abs(withShadow[i+1]-163)<3&&Math.abs(withShadow[i+2]-91)<3)yellowPixels++;
      }
      return {whitePixels,shadowPixels,leafPixels,yellowPixels,shadowOffset:[sx/shadowPixels-wx/whitePixels,sy/shadowPixels-wy/whitePixels],filters:document.querySelectorAll('.flowers [filter],.flowers filter').length};
    });
    assert.equal(result.filters,0,'flower geometry renders without filter references');
    assert.ok(result.whitePixels>300,'white petals must actually paint: '+JSON.stringify(result));
    assert.ok(result.leafPixels>100,'leaves must actually paint: '+JSON.stringify(result));
    assert.ok(result.yellowPixels>40,'yellow centers must actually paint: '+JSON.stringify(result));
    assert.ok(result.shadowPixels>50,'head shadows must actually paint: '+JSON.stringify(result));
    assert.ok(result.shadowOffset[0]>4 && result.shadowOffset[1]>8,'visible shadows project to the front right: '+JSON.stringify(result));
    await page.screenshot({path:'/tmp/facefield-flower-rendering.png'});
    console.log('PASS rendered flower pixels:',process.env.FACEFIELD_BROWSER||'chromium',JSON.stringify(result));
  } finally {await browser.close();}
})();
