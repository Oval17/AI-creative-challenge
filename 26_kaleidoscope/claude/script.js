'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

// ── Kaleidoscope config ───────────────────────────────────────
const SLICES=12;
const SLICE_ANGLE=(Math.PI*2)/SLICES;
const R=Math.min(CW,CH)*0.48;
const cx=CW/2,cy=CH/2;

// Off-screen wedge buffer
const buf=document.createElement('canvas');
buf.width=Math.ceil(R)+2;buf.height=Math.ceil(R)+2;
const bctx=buf.getContext('2d');

// ── Particles in wedge ────────────────────────────────────────
const NUM_P=90;
const particles=[];
for(let i=0;i<NUM_P;i++) particles.push(mkParticle());

function mkParticle(){
  return{
    angle:Math.random()*SLICE_ANGLE*0.5,
    radius:Math.random()*R*0.88+8,
    speed:(Math.random()*0.0025+0.001)*(Math.random()<0.5?1:-1),
    radSpeed:(Math.random()*0.35+0.08)*(Math.random()<0.5?1:-1),
    size:Math.random()*6+2,
    hue:Math.random()*360,
    hueSpeed:Math.random()*0.9+0.2,
    alpha:Math.random()*0.5+0.4,
    trail:[],
  };
}

let t=0;

function drawWedge(){
  // Fade
  bctx.fillStyle='rgba(5,5,5,0.20)';
  bctx.fillRect(0,0,buf.width,buf.height);

  // Flowing lines
  for(let layer=0;layer<4;layer++){
    bctx.beginPath();
    for(let r=0;r<R;r+=3){
      const a=Math.sin(r*0.016+t*0.45+layer*1.1)*SLICE_ANGLE*0.38;
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
      r===0?bctx.moveTo(x,y):bctx.lineTo(x,y);
    }
    const hue=(t*28+layer*90)%360;
    bctx.strokeStyle=`hsla(${hue},100%,65%,0.13)`;
    bctx.lineWidth=1.5;bctx.stroke();
  }

  particles.forEach(p=>{
    // Update
    p.angle+=p.speed;p.radius+=p.radSpeed*0.12;
    if(p.angle<0||p.angle>SLICE_ANGLE*0.5) p.speed*=-1;
    if(p.radius<8||p.radius>R*0.90) p.radSpeed*=-1;
    p.hue=(p.hue+p.hueSpeed)%360;
    const px=Math.cos(p.angle)*p.radius,py=Math.sin(p.angle)*p.radius;
    p.trail.push({x:px,y:py});
    if(p.trail.length>20) p.trail.shift();

    // Trail
    if(p.trail.length>1){
      for(let i=1;i<p.trail.length;i++){
        const al=(i/p.trail.length)*p.alpha*0.55;
        bctx.beginPath();
        bctx.moveTo(p.trail[i-1].x,p.trail[i-1].y);
        bctx.lineTo(p.trail[i].x,p.trail[i].y);
        bctx.strokeStyle=`hsla(${p.hue},100%,70%,${al})`;
        bctx.lineWidth=p.size*0.4;bctx.stroke();
      }
    }
    // Glow dot
    const g=bctx.createRadialGradient(px,py,0,px,py,p.size*2.8);
    g.addColorStop(0,`hsla(${p.hue},100%,88%,${p.alpha})`);
    g.addColorStop(1,`hsla(${p.hue},100%,60%,0)`);
    bctx.fillStyle=g;
    bctx.beginPath();bctx.arc(px,py,p.size*2.8,0,Math.PI*2);bctx.fill();
  });
}

function render(){
  ctx.fillStyle='#050505';ctx.fillRect(0,0,CW,CH);
  drawWedge();

  for(let s=0;s<SLICES;s++){
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(s*SLICE_ANGLE);
    if(s%2===1){ctx.scale(-1,1);ctx.rotate(-SLICE_ANGLE);}
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,0,SLICE_ANGLE);ctx.closePath();ctx.clip();
    ctx.drawImage(buf,0,0);
    ctx.restore();
  }

  // Centre glow
  const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.14);
  cg.addColorStop(0,`hsla(${(t*38)%360},80%,85%,0.40)`);
  cg.addColorStop(1,'rgba(5,5,5,0)');
  ctx.fillStyle=cg;ctx.fillRect(0,0,CW,CH);

  // Vignette
  const vg=ctx.createRadialGradient(cx,cy,R*0.52,cx,cy,R*1.05);
  vg.addColorStop(0,'rgba(5,5,5,0)');vg.addColorStop(1,'rgba(5,5,5,0.80)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,CW,CH);

  t+=0.009;
}

// ── Audio ─────────────────────────────────────────────────────
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();
  master.gain.setValueAtTime(0,aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.88,aCtx.currentTime+3);
  const comp=aCtx.createDynamicsCompressor();
  comp.threshold.value=-12;comp.knee.value=8;comp.ratio.value=6;
  comp.attack.value=0.003;comp.release.value=0.12;
  master.connect(comp);comp.connect(aCtx.destination);

  // Reverb
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*3,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);}
  const rev=aCtx.createConvolver();rev.buffer=rb;
  const rg=aCtx.createGain();rg.gain.value=0.85;rev.connect(rg);rg.connect(master);

  // Hypnotic drone tones – kaleidoscope crystal frequencies
  [[220,0.06],[330,0.04],[440,0.03],[165,0.05]].forEach(([freq,vol],i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type=i%2===0?'sine':'triangle';o.frequency.value=freq;g.gain.value=vol;
    const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
    lfo.frequency.value=0.04+i*0.025;lg.gain.value=freq*0.01;
    lfo.connect(lg);lg.connect(o.frequency);lfo.start();
    o.connect(g);g.connect(rev);o.start();
  });

  // Shimmer – periodic high crystal ping
  function ping(){
    const now=aCtx.currentTime;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    const freq=880+Math.random()*880;
    o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.18,now+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,now+1.8);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+1.9);
    setTimeout(ping,800+Math.random()*2200);
  }
  setTimeout(ping,600);

  // Ambient noise wash
  const nb=aCtx.createBuffer(1,aCtx.sampleRate*2,aCtx.sampleRate);
  const nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=aCtx.createBufferSource();ns.buffer=nb;ns.loop=true;
  const lp=aCtx.createBiquadFilter();lp.type='bandpass';lp.frequency.value=800;lp.Q.value=0.8;
  const ng=aCtx.createGain();ng.gain.value=0.04;
  ns.connect(lp);lp.connect(ng);ng.connect(rev);ns.start();
}

// ── Loop ──────────────────────────────────────────────────────
function animate(){render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
document.addEventListener('click',function(){try{initAudio();}catch(e){}},{once:true});
document.addEventListener('touchstart',function(){try{initAudio();}catch(e){}},{once:true});
