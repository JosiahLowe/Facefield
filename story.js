// Seconds of visible time. Travel can take as long as necessary; arrival is
// explicit, never guessed from the distance or from an animation timeout.
export const STORY_TIMING = { introduction: .8, scream: .85, death: .2 };
export const STORY_STATES = ['idle','traveling','singing','scream','death','crying','discovered'];

export function createStorySequence(onEnter = () => {}) {
  let state = 'idle', elapsed = 0;
  function enter(next) { state = next; elapsed = 0; onEnter(next); }
  return {
    get state() { return state; },
    get elapsed() { return elapsed; },
    start() { if (state !== 'idle') return false; enter('traveling'); return true; },
    redirect() { if(!['traveling','singing','scream'].includes(state))return false;enter('traveling');return true; },
    step(dt, { arrived = false, discovered = false, offscreen = false } = {}) {
      elapsed += Math.max(0, dt);
      if (state === 'traveling' && arrived) enter('singing');
      else if (state === 'singing' && elapsed >= STORY_TIMING.introduction && offscreen) enter('scream');
      else if (state === 'scream' && !offscreen) enter('singing');
      else if (state === 'scream' && elapsed >= STORY_TIMING.scream && offscreen) enter('death');
      else if (state === 'death' && elapsed >= STORY_TIMING.death) enter('crying');
      else if (state === 'crying' && discovered) enter('discovered');
    },
    resume() { if (state !== 'discovered') return false; enter('idle'); return true; },
  };
}

export function outsideViewport(face,view,margin=0){
  return face.right<=view.left-margin||face.left>=view.right+margin
    ||face.bottom<=view.top-margin||face.top>=view.bottom+margin;
}

// Match the existing close-listening area (12% of the viewport diagonal).
// All arguments are world pixels, including visualViewport offsets on Safari.
export function inDiscoveryArea(face, view, extent = null) {
  // An edge singer cannot be centered by scrolling. Project onto the closest
  // reachable camera center, including after a phone rotation or resize.
  const x=extent?Math.max(view.width/2,Math.min(extent.width-view.width/2,face.x)):face.x;
  const y=extent?Math.max(view.height/2,Math.min(extent.height-view.height/2,face.y)):face.y;
  return Math.hypot(x-view.x-view.width/2, y-view.y-view.height/2)
    <= Math.hypot(view.width,view.height)*.12;
}

export function createMothStory({ button, singer, butterfly, animation, world, candidates }) {
  let tile = null, frame = 0, last = null;
  const sequence = createStorySequence(state => {
    world.dataset.mothStory = state;
    button.disabled = state !== 'idle';
    if(state==='singing'){
      singer.setScene('song');animation.setStoryExpression(tile,null);
    }else if(state==='scream'){
      singer.setScene('scream');animation.setStoryExpression(tile,'scream');
    }else if(state==='death'){
      // Resolve the death atomically while offscreen. A visible fall could be
      // caught by a single fast scroll even after checking its starting frame.
      singer.setScene('silence');butterfly.fall({immediate:true});
    }else if(state==='crying'){
      singer.setScene('crying');animation.setStoryExpression(tile,'crying');
      tile.setAttribute('aria-label','Crying singer');
    }else if(state==='discovered'){
      singer.setScene('discovered');
      tile.setAttribute('aria-label','Crying singer: resume normal singing');
      tile.setAttribute('aria-description','Tap or press Enter or Space to resume normal singer progression.');
    }
  });
  world.dataset.mothStory = 'idle';
  function viewport(){
    const rect=world.getBoundingClientRect(),view=window.visualViewport;
    const left=Math.max(rect.left,view?.offsetLeft||0),top=Math.max(rect.top,view?.offsetTop||0);
    const right=Math.min(rect.right,(view?.offsetLeft||0)+(view?.width||innerWidth));
    const bottom=Math.min(rect.bottom,(view?.offsetTop||0)+(view?.height||innerHeight));
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  function distantCandidates(){
    const view=viewport();
    return candidates().filter(t=>outsideViewport(t.getBoundingClientRect(),view,Math.max(view.width,view.height)));
  }
  function redirect(){
    const available=distantCandidates();if(!available.length)return false;
    singer.setScene('song');animation.setStoryExpression(tile,null);
    const next=singer.advanceNow(available);if(!next)return false;
    tile=next;sequence.redirect();butterfly.beginStory(tile);return true;
  }
  function tick(now) {
    frame = 0;
    if (sequence.state === 'idle' || document.hidden) { last = null; return; }
    const dt = last === null ? 0 : Math.min(.1,(now-last)/1000); last = now;
    butterfly.updateStory(now);
    const view=window.visualViewport;
    const found=inDiscoveryArea({x:tile.offsetLeft+tile.offsetWidth/2,y:tile.offsetTop+tile.offsetHeight/2},
      {x:world.scrollLeft+(view?.offsetLeft||0),y:world.scrollTop+(view?.offsetTop||0),
        width:view?.width||world.clientWidth,height:view?.height||world.clientHeight},
      {width:world.scrollWidth,height:world.scrollHeight});
    const offscreen=outsideViewport(tile.getBoundingClientRect(),viewport());
    // If the player races ahead, move the scene to a fresh distant singer,
    // rather than leaving the moth waiting in front of a watched face.
    if(!offscreen&&(sequence.state==='scream'||sequence.state==='singing'&&sequence.elapsed+dt>=STORY_TIMING.introduction)){
      if(redirect()){frame=requestAnimationFrame(tick);return;}
    }
    sequence.step(dt, { arrived: butterfly.storyArrived(), discovered: found,
      offscreen });
    frame = requestAnimationFrame(tick);
  }
  function wake() { if (!frame && !document.hidden && sequence.state !== 'idle') frame = requestAnimationFrame(tick); }
  button.addEventListener('click', () => {
    if (sequence.state !== 'idle') return;
    const next = singer.advanceNow(distantCandidates());
    if (!next) return;
    tile = next;
    sequence.start();
    butterfly.beginStory(tile);
    last = null; wake();
  });
  document.addEventListener('visibilitychange', () => { last = null; wake(); });
  return {
    get state() { return sequence.state; },
    get target() { return tile; },
    resume(){
      if(sequence.state!=='discovered')return false;
      const next=candidates();if(!next.length)return false;
      cancelAnimationFrame(frame);frame=0;last=null;
      singer.setScene('song');animation.setStoryExpression(tile,null);
      butterfly.endStory();
      sequence.resume();tile=null;
      singer.advanceNow(next);
      return true;
    },
  };
}
