// A clock-driven scheduling/connection spy. Real synthesis is rendered separately
// with OfflineAudioContext; this lets multi-minute world events run deterministically.
module.exports=function installAudioSpy(){
  window.audioRecords=[];window.audioNodes=[];window.audioContexts=[];
  const param=value=>({value,events:[],setValueAtTime(v,t){this.value=v;this.events.push({v,t});},
    linearRampToValueAtTime(v,t){this.events.push({v,t});},exponentialRampToValueAtTime(v,t){this.events.push({v,t});},
    setTargetAtTime(v,t){this.value=v;this.events.push({v,t});},cancelScheduledValues(){},cancelAndHoldAtTime(){}});
  class Node{
    constructor(kind){this.kind=kind;this.outputs=[];window.audioNodes.push(this);}
    connect(n){if(!n)throw Error('missing audio destination');this.outputs.push(n);this.output=n;return n;}
    disconnect(){this.outputs=[];this.disconnected=true;}
  }
  window.AudioContext=class{
    constructor(){this.state='suspended';this.sampleRate=48000;this.destination=new Node('destination');window.audioContexts.push(this);}
    get currentTime(){return performance.now()/1000;}
    async resume(){this.state='running';}async suspend(){this.state='suspended';}
    addEventListener(){}createPeriodicWave(real,imag){return {real,imag};}
    createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,getChannelData:i=>data[i]};}
    createGain(){const n=new Node('gain');n.gain=param(1);return n;}
    createStereoPanner(){const n=new Node('panner');n.pan=param(0);return n;}
    createBiquadFilter(){const n=new Node('filter');n.frequency=param(350);n.Q=param(1);return n;}
    createConvolver(){return new Node('convolver');}
    createDynamicsCompressor(){const n=new Node('limiter');for(const k of ['threshold','knee','ratio','attack','release'])n[k]=param(0);return n;}
    source(kind){const n=new Node(kind);n.frequency=param(440);n.detune=param(0);n.setPeriodicWave=w=>n.wave=w;
      n.start=(t=0)=>{n.startAt=t;window.audioRecords.push(n);};
      n.stop=t=>{n.endAt=t??this.currentTime;clearTimeout(n.timer);n.timer=setTimeout(()=>n.onended?.(),Math.max(0,(n.endAt-this.currentTime)*1000));};return n;}
    createOscillator(){return this.source('oscillator');}createBufferSource(){return this.source('buffer');}
  };
};
