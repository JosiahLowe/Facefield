const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const engine=process.env.FACEFIELD_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch(engine===chromium?{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}:{});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield&style=original');
  await page.waitForSelector('.flower[data-stage=bloom][data-form=daisy]');
  const result=await page.evaluate(async()=>{
   const original=document.querySelector('.flower[data-stage=bloom][data-form=daisy]'),ns='http://www.w3.org/2000/svg';
   const rgb=hex=>hex.slice(1).match(/../g).map(c=>parseInt(c,16));
   const colors=['.flower-petals','.flower-stem','.flower-center'].map(s=>rgb(original.querySelector(s).getAttribute('fill')));
   async function paint(shadows){
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','128');svg.setAttribute('height','128');svg.setAttribute('viewBox','0 0 128 128');
    const flower=original.cloneNode(true);flower.setAttribute('transform','translate(64 100) scale(80)');flower.setAttribute('opacity','1');
    flower.querySelector('.flower-growth').setAttribute('transform','scale(1)');flower.querySelector('.flower-sticker-shadow').setAttribute('transform','matrix(1 0 -.12 .88 0 0)');
    if(!shadows)flower.querySelector('.flower-sticker-shadow').remove();svg.append(flower);
    const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await image.decode();
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d');context.fillStyle='#F3F0EB';context.fillRect(0,0,128,128);context.drawImage(image,0,0);
    return context.getImageData(0,0,128,128).data;
   }
   const withShadow=await paint(true),withoutShadow=await paint(false),counts=[0,0,0];let shadowPixels=0,lowerShadows=0;
   for(let i=0;i<withShadow.length;i+=4){
    colors.forEach((c,j)=>{if(c.every((v,k)=>Math.abs(v-withShadow[i+k])<3))counts[j]++;});
    if(withShadow[i]+withShadow[i+1]+withShadow[i+2]+10<withoutShadow[i]+withoutShadow[i+1]+withoutShadow[i+2]){shadowPixels++;if(Math.floor(i/4/128)>75)lowerShadows++;}
   }
   const stemShadow=original.querySelector('.flower-sticker-stem-shadow').getAttribute('href')===original.querySelector('.flower-stem use').getAttribute('href');
   return {counts,shadowPixels,lowerShadows,stemShadow,filters:document.querySelectorAll('.flowers [filter],.flowers filter').length};
  });
  assert.equal(result.filters,0);assert.ok(result.counts[0]>200,'colored petals paint');assert.ok(result.counts[1]>60,'stem and pointed leaves paint');assert.ok(result.counts[2]>35,'center paints');
  assert.ok(result.shadowPixels>80,'whole-plant silhouette paints');assert.ok(result.lowerShadows>20,'shadow extends beneath the flower head');assert.ok(result.stemShadow,'stem and its shadow share the same source geometry');
  console.log('PASS rendered individual flower and sticker silhouette:',JSON.stringify(result));
 }finally{await browser.close();}
})();
