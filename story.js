import {selectChorusCompanions} from './chorus.js?v=nearby-chorus-27';

export const STORY_TIMING={offscreen:2,chorusTail:.65,scream:.85,death:.2};
export const STORY_STATES=['idle','chorus_starting','chorus_active','death_pending','scream','death','crying','discovered'];
export function createStorySequence(onEnter=()=>{}){
  let state='idle',elapsed=0,away=0;
  const enter=next=>{state=next;elapsed=0;onEnter(next);};
  return {
    get state(){return state;},get elapsed(){return elapsed;},get offscreenTime(){return away;},
    start(){if(state!=='idle')return false;away=0;enter('chorus_starting');return true;},
    pause(){away=0;if(state==='death_pending')enter('chorus_active');},
    step(dt,{voices=0,arrived=false,investigated=false,offscreen=false,playing=false,discovered=false}={}){
      dt=Math.max(0,dt);elapsed+=dt;
      const eligible=voices===3&&arrived&&investigated&&offscreen&&playing;
      if(state==='chorus_starting'&&voices===3)enter('chorus_active');
      else if(state==='chorus_active'){
        away=eligible?away+dt:0;
        if(away>=STORY_TIMING.offscreen)enter('death_pending');
      }else if(state==='death_pending'){
        if(!eligible){away=0;enter('chorus_active');}
        else{away+=dt;if(elapsed>=STORY_TIMING.chorusTail)enter('scream');}
      }else if(state==='scream'){
        // Once-only scream. A racing player can postpone the death, but cannot
        // cause another scream or observe a falling/teleporting living moth.
        away=offscreen?away+dt:0;
        if(elapsed>=STORY_TIMING.scream&&away>=STORY_TIMING.offscreen)enter('death');
      }else if(state==='death'&&elapsed>=STORY_TIMING.death)enter('crying');
      else if(state==='crying'&&discovered)enter('discovered');
    },
    resume(){if(state!=='discovered')return false;away=0;enter('idle');return true;},
  };
}
export function outsideViewport(face,view,margin=0){
  return face.right<=view.left-margin||face.left>=view.right+margin||face.bottom<=view.top-margin||face.top>=view.bottom+margin;
}
export function inDiscoveryArea(face,view,extent=null){
  const x=extent?Math.max(view.width/2,Math.min(extent.width-view.width/2,face.x)):face.x;
  const y=extent?Math.max(view.height/2,Math.min(extent.height-view.height/2,face.y)):face.y;
  return Math.hypot(x-view.x-view.width/2,y-view.y-view.height/2)<=Math.hypot(view.width,view.height)*.12;
}
export function createMothStory({button,singer,butterfly,flowers,animation,world,candidates}){
  let tile=null,companions=[],frame=0,last=null,seenHome=false,investigated=false,focusPaused=false;
  const sequence=createStorySequence(state=>{
    world.dataset.mothStory=state;button.disabled=state!=='idle';
    if(state==='scream'){singer.setScene('scream');animation.setStoryExpression(tile,'scream');}
    else if(state==='death'){
      singer.setScene('silence');butterfly.fall({immediate:true});flowers.clear();
    }else if(state==='crying'){
      singer.setScene('crying');animation.setStoryExpression(tile,'crying');tile.setAttribute('aria-label','Crying singer');
    }else if(state==='discovered'){
      singer.setScene('discovered');tile.setAttribute('aria-label','Crying singer: resume normal singing');
      tile.setAttribute('aria-description','Tap or press Enter or Space to resume normal singer progression.');
    }
  });
  world.dataset.mothStory='idle';
  function viewport(){
    const r=world.getBoundingClientRect(),v=window.visualViewport;
    const left=Math.max(r.left,v?.offsetLeft||0),top=Math.max(r.top,v?.offsetTop||0);
    const right=Math.min(r.right,(v?.offsetLeft||0)+(v?.width||innerWidth));
    const bottom=Math.min(r.bottom,(v?.offsetTop||0)+(v?.height||innerHeight));
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  function closeTo(face){
    const v=window.visualViewport;
    return inDiscoveryArea({x:face.offsetLeft+face.offsetWidth/2,y:face.offsetTop+face.offsetHeight/2},
      {x:world.scrollLeft+(v?.offsetLeft||0),y:world.scrollTop+(v?.offsetTop||0),width:v?.width||world.clientWidth,height:v?.height||world.clientHeight},
      {width:world.scrollWidth,height:world.scrollHeight});
  }
  function tick(now){
    frame=0;
    if(sequence.state==='idle'||document.hidden||focusPaused){last=null;return;}
    const dt=last===null?0:Math.min(.1,(now-last)/1000);last=now;
    butterfly.updateStory(now);
    const view=viewport(),arrived=butterfly.storyArrived(),status=singer.chorusStatus();
    const face=tile.getBoundingClientRect(),moth=butterfly.bounds();
    const faceVisible=!outsideViewport(face,view);
    if(arrived&&faceVisible)seenHome=true;
    if(seenHome&&companions.some(t=>status.joined.includes(t)&&closeTo(t)))investigated=true;
    const safelyOffscreen=outsideViewport(face,view,96)&&outsideViewport(moth,view,96);
    sequence.step(dt,{voices:status.joined.length,arrived,investigated:seenHome&&investigated,
      offscreen:safelyOffscreen,playing:status.playing,discovered:closeTo(tile)});
    frame=requestAnimationFrame(tick);
  }
  function wake(){if(!frame&&!document.hidden&&!focusPaused&&sequence.state!=='idle')frame=requestAnimationFrame(tick);}
  button.addEventListener('click',()=>{
    if(sequence.state!=='idle')return;
    const next=singer.advanceNow(candidates());if(!next)return;
    tile=next;
    const records=candidates().map(t=>({tile:t,x:t.offsetLeft+t.offsetWidth/2,y:t.offsetTop+t.offsetHeight/2}));
    const original={tile,x:tile.offsetLeft+tile.offsetWidth/2,y:tile.offsetTop+tile.offsetHeight/2};
    companions=selectChorusCompanions(records,original,viewport()).map(r=>r.tile);
    if(companions.length!==2){tile=null;return;}
    seenHome=false;investigated=false;sequence.start();singer.setEventActive(true);singer.startChorus(companions);butterfly.beginChorus(tile);last=null;wake();
  });
  function pause(){last=null;sequence.pause();butterfly.pauseChorus(true);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else{butterfly.pauseChorus(false);wake();}});
  window.addEventListener('blur',()=>{focusPaused=true;pause();});
  window.addEventListener('focus',()=>{focusPaused=false;butterfly.pauseChorus(false);wake();});
  return {
    get state(){return sequence.state;},get target(){return tile;},
    resume(){
      if(sequence.state!=='discovered')return false;
      const next=candidates();if(!next.length)return false;
      cancelAnimationFrame(frame);frame=0;last=null;singer.setScene('song');animation.setStoryExpression(tile,null);animation.clearMourning();
      butterfly.endStory();singer.setEventActive(false);sequence.resume();tile=null;companions=[];singer.advanceNow(next);return true;
    },
  };
}
