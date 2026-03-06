'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

// ── Gravity wells ─────────────────────────────────────────────
const N_WELLS=3;
const wells=[];
function resetWells(){
  wells.length=0;
  for(let i=0;i<N_WELLS;i++){
    wells.push({
      x:CW*0.2+Math.random()*CW*0.6,
      y:CH*0.2+Math.random()*CH*0.6,
      mass:2000+Math.random()*4000,
      vx:(Math.random()-0.5)*0.4,
      vy:(Math.random()-0.5)*0.4,
      hue:Math.random()*360,
    });
  }
}

// ── Particles ─────────────────────────────────────────────────
const N_PARTICLES=1200;
const px=new Float32Array(N_PARTICLES);
const py=new Float32Array(N_PARTICLES);
const pvx=new Float32Array(N_PARTICLES);
const pvy=new Float32Array(N_PARTICLES);
const phue=new Float32Array(N_PARTICLES);
const palpha=new Float32Array(N_PARTICLES);

function spawnParticle(i){
  // Spawn in a ring around a random well
  const w=wells[Math.floor(Math.random()*wells.length)];
  const angle=Math.random()*Math.PI*2;
  const r=60+Math.random()*280;
  px[i]=w.x+Math.cos(angle)*r;
  py[i]=w.y+Math.sin(angle)*r;
  // Orbital velocity perpendicular to radial direction
  const speed=Math.sqrt(w.mass/(r+1))*0.35;
  pvx[i]=-Math.sin(angle)*speed+(Math.random()-0.5)*0.5;
  pvy[i]= Math.cos(angle)*speed+(Math.random()-0.5)*0.5;
  phue[i]=w.hue+Math.random()*60-30;
  palpha[i]=0.6+Math.random()*0.4;
}

function initParticles(){
  for(let i=0;i<N_PARTICLES;i++) spawnParticle(i);
}

resetWells();
initParticles();

// ── Trail canvas ──────────────────────────────────────────────
const trailC=document.createElement('canvas');trailC.width=CW;trailC.height=CH;
const trailCtx=trailC.getContext('2d');
trailCtx.fillStyle='#050508';trailCtx.fillRect(0,0,CW,CH);

// ── Physics ───────────────────────────────────────────────────
const G=1.0;
const SOFTENING=30;

function update(){
  // Move wells slowly (they interact with each other)
  for(let a=0;a<wells.length;a++){
    for(let b=a+1;b<wells.length;b++){
      const dx=wells[b].x-wells[a].x;
      const dy=wells[b].y-wells[a].y;
      const r2=dx*dx+dy*dy+SOFTENING*SOFTENING;
      const r=Math.sqrt(r2);
      const f=G*wells[a].mass*wells[b].mass/r2;
      const fx=f*dx/r,fy=f*dy/r;
      wells[a].vx+=fx/wells[a].mass*0.1;
      wells[a].vy+=fy/wells[a].mass*0.1;
      wells[b].vx-=fx/wells[b].mass*0.1;
      wells[b].vy-=fy/wells[b].mass*0.1;
    }
  }
  for(const w of wells){
    w.x+=w.vx;w.y+=w.vy;
    // Soft boundary: nudge back
    if(w.x<80){w.vx+=0.2;}if(w.x>CW-80){w.vx-=0.2;}
    if(w.y<80){w.vy+=0.2;}if(w.y>CH-80){w.vy-=0.2;}
    w.vx*=0.998;w.vy*=0.998;
  }

  // Update particles
  for(let i=0;i<N_PARTICLES;i++){
    let ax=0,ay=0;
    for(const w of wells){
      const dx=w.x-px[i],dy=w.y-py[i];
      const r2=dx*dx+dy*dy+SOFTENING*SOFTENING;
      const r=Math.sqrt(r2);
      const f=G*w.mass/r2;
      ax+=f*dx/r;ay+=f*dy/r;
    }
    pvx[i]+=ax*0.009;pvy[i]+=ay*0.009;
    // Speed cap
    const spd=Math.sqrt(pvx[i]*pvx[i]+pvy[i]*pvy[i]);
    if(spd>7){pvx[i]=pvx[i]/spd*7;pvy[i]=pvy[i]/spd*7;}
    px[i]+=pvx[i]*0.6;py[i]+=pvy[i]*0.6;

    // Respawn if too close to a well or out of bounds
    let dead=false;
    for(const w of wells){
      const dx=w.x-px[i],dy=w.y-py[i];
      if(dx*dx+dy*dy<600) dead=true;
    }
    if(px[i]<-100||px[i]>CW+100||py[i]<-100||py[i]>CH+100) dead=true;
    if(dead) spawnParticle(i);
  }
}

// ── Render ────────────────────────────────────────────────────
function render(){
  // Fade trail
  trailCtx.fillStyle='rgba(5,5,8,0.18)';
  trailCtx.fillRect(0,0,CW,CH);

  // Draw particles onto trail
  for(let i=0;i<N_PARTICLES;i++){
    const spd=Math.sqrt(pvx[i]*pvx[i]+pvy[i]*pvy[i]);
    const bright=40+Math.min(spd*4,55);
    trailCtx.fillStyle=`hsla(${phue[i]},100%,${bright}%,${palpha[i]*0.7})`;
    trailCtx.beginPath();trailCtx.arc(px[i],py[i],1.4,0,Math.PI*2);trailCtx.fill();
  }

  // Composite trail
  ctx.drawImage(trailC,0,0);

  // Draw wells with glow
  for(const w of wells){
    // Outer glow
    const grd=ctx.createRadialGradient(w.x,w.y,0,w.x,w.y,80);
    grd.addColorStop(0,`hsla(${w.hue},100%,80%,0.55)`);
    grd.addColorStop(0.4,`hsla(${w.hue},100%,55%,0.15)`);
    grd.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grd;ctx.fillRect(w.x-80,w.y-80,160,160);

    // Core
    ctx.fillStyle=`hsl(${w.hue},100%,90%)`;
    ctx.shadowBlur=30;ctx.shadowColor=`hsl(${w.hue},100%,70%)`;
    ctx.beginPath();ctx.arc(w.x,w.y,8,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;

    // Gravity ring
    for(let r=1;r<=3;r++){
      const ring=r*45;
      ctx.strokeStyle=`hsla(${w.hue},80%,60%,${0.12/r})`;
      ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(w.x,w.y,ring,0,Math.PI*2);ctx.stroke();
    }
  }

  // Subtle vignette
  const vig=ctx.createRadialGradient(CW/2,CH/2,CH*0.3,CW/2,CH/2,CH*0.75);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.6)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,CW,CH);
}

// ── Periodic well shuffle ─────────────────────────────────────
let shuffleTimer=0;
function maybeReshuffle(){
  shuffleTimer++;
  if(shuffleTimer>500){
    shuffleTimer=0;
    // Gently perturb wells rather than full reset
    for(const w of wells){
      w.vx+=(Math.random()-0.5)*0.8;
      w.vy+=(Math.random()-0.5)*0.8;
    }
  }
}

// ── Audio ─────────────────────────────────────────────────────
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();master.gain.setValueAtTime(0,aCtx.currentTime);master.gain.linearRampToValueAtTime(0.45,aCtx.currentTime+3);master.connect(aCtx.destination);
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*3,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.8);}
  const rev=aCtx.createConvolver();rev.buffer=rb;const rg=aCtx.createGain();rg.gain.value=0.55;rev.connect(rg);rg.connect(master);
  // Deep space drone per well
  wells.forEach((w,i)=>{
    const freq=[55,82.4,110][i]||55;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=freq;g.gain.value=0.06;
    const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
    lfo.frequency.value=0.05+i*0.03;lg.gain.value=8;
    lfo.connect(lg);lg.connect(o.frequency);lfo.start();
    o.connect(g);g.connect(rev);o.start();
  });
  // Cosmic wind
  const nb=aCtx.createBuffer(1,aCtx.sampleRate*3,aCtx.sampleRate);
  const nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=aCtx.createBufferSource();ns.buffer=nb;ns.loop=true;
  const lp=aCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=200;lp.Q.value=4;
  const ng=aCtx.createGain();ng.gain.value=0.08;
  ns.connect(lp);lp.connect(ng);ng.connect(rev);ns.start();
  // Particle whoosh (speed-reactive, periodic)
  function whoosh(){
    const now=aCtx.currentTime;
    let avgSpd=0;for(let i=0;i<100;i++) avgSpd+=Math.sqrt(pvx[i]*pvx[i]+pvy[i]*pvy[i]);
    avgSpd/=100;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sawtooth';o.frequency.value=80+avgSpd*30;
    const lp2=aCtx.createBiquadFilter();lp2.type='lowpass';lp2.frequency.value=300+avgSpd*200;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.05,now+0.3);g.gain.exponentialRampToValueAtTime(0.0001,now+1.2);
    o.connect(lp2);lp2.connect(g);g.connect(rev);o.start(now);o.stop(now+1.3);
    setTimeout(whoosh,1200+Math.random()*1800);
  }
  setTimeout(whoosh,800);
}

// ── Loop ──────────────────────────────────────────────────────
function animate(){
  update();
  maybeReshuffle();
  render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
document.addEventListener('click', function(){ try{initAudio();}catch(e){} }, {once:true});
document.addEventListener('touchstart', function(){ try{initAudio();}catch(e){} }, {once:true});
