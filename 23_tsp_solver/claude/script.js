'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

const N_CITIES=30;
const MARGIN=100;

function randCities(){
  const c=[];
  for(let i=0;i<N_CITIES;i++) c.push({x:MARGIN+Math.random()*(CW-MARGIN*2),y:MARGIN+Math.random()*(CH-MARGIN*2)});
  return c;
}
function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}
function tourLen(cities,tour){let d=0;for(let i=0;i<tour.length;i++) d+=dist(cities[tour[i]],cities[tour[(i+1)%tour.length]]);return d;}

let cities=[],tour=[],bestLen=Infinity,bestTour=[];
let phase='optimizing';
let phaseTimer=0,fadeAlpha=1,optPasses=0;
let drawnEdge=0; // how many edges have been "drawn in" so far

function initTour(){
  cities=randCities();
  tour=Array.from({length:N_CITIES},(_,i)=>i);
  // Nearest-neighbour init
  const visited=new Uint8Array(N_CITIES);
  tour[0]=0;visited[0]=1;
  for(let i=1;i<N_CITIES;i++){
    let best=-1,bd=Infinity;
    for(let j=0;j<N_CITIES;j++){if(!visited[j]){const d=dist(cities[tour[i-1]],cities[j]);if(d<bd){bd=d;best=j;}}}
    tour[i]=best;visited[best]=1;
  }
  bestLen=tourLen(cities,tour);
  bestTour=[...tour];
  phase='drawing'; drawnEdge=0; phaseTimer=0; fadeAlpha=1; optPasses=0;
}

// One full 2-opt pass
function twoOptPass(){
  const n=tour.length;
  for(let i=0;i<n-1;i++){
    for(let j=i+2;j<n;j++){
      if(j===0&&i===n-1) continue;
      const d0=dist(cities[tour[i]],cities[tour[i+1]])+dist(cities[tour[j]],cities[tour[(j+1)%n]]);
      const d1=dist(cities[tour[i]],cities[tour[j]])+dist(cities[tour[i+1]],cities[tour[(j+1)%n]]);
      if(d1<d0-0.5){let a=i+1,b=j;while(a<b){const t=tour[a];tour[a]=tour[b];tour[b]=t;a++;b--;}}
    }
  }
  const l=tourLen(cities,tour);if(l<bestLen){bestLen=l;bestTour=[...tour];}
  optPasses++;
}

initTour();

// ── Audio ─────────────────────────────────────────────────────
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();
  master.gain.setValueAtTime(0,aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.5,aCtx.currentTime+2.5);
  master.connect(aCtx.destination);

  const rb=aCtx.createBuffer(2,aCtx.sampleRate*2,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);}
  const rev=aCtx.createConvolver();rev.buffer=rb;
  const rg=aCtx.createGain();rg.gain.value=0.5;rev.connect(rg);rg.connect(master);

  // Thinking hum — slow pad
  [82.4,110,164.8,220].forEach((f,i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='triangle';o.frequency.value=f;g.gain.value=0.04-i*0.007;
    const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
    lfo.frequency.value=0.12+i*0.05;lg.gain.value=f*0.003;
    lfo.connect(lg);lg.connect(o.frequency);lfo.start();
    o.connect(g);g.connect(rev);o.start();
  });

  // Edge connection sound — soft click as each edge draws
  function edgeTick(){
    if(drawnEdge>0&&drawnEdge<N_CITIES){
      const now=aCtx.currentTime;
      // Pitch rises as tour closes
      const freq=180+drawnEdge*(800/N_CITIES);
      const o=aCtx.createOscillator();const g=aCtx.createGain();
      o.type='sine';o.frequency.value=freq;
      g.gain.setValueAtTime(0.08,now);g.gain.exponentialRampToValueAtTime(0.0001,now+0.18);
      o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.2);
    }
    setTimeout(edgeTick,90);
  }
  setTimeout(edgeTick,200);

  // Optimization "swap" sound — bright click when a swap happens
  function swapSound(){
    if(phase==='optimizing'&&optPasses>0){
      const now=aCtx.currentTime;
      const o=aCtx.createOscillator();const g=aCtx.createGain();
      o.type='sine';o.frequency.value=600+Math.random()*400;
      g.gain.setValueAtTime(0.05,now);g.gain.exponentialRampToValueAtTime(0.0001,now+0.12);
      o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.15);
    }
    setTimeout(swapSound,200);
  }
  setTimeout(swapSound,400);

  // Completion chime — tour finished
  window.playComplete=function(){
    const now=aCtx.currentTime;
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>{
      const o=aCtx.createOscillator();const g=aCtx.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,now+i*0.12);g.gain.linearRampToValueAtTime(0.08,now+i*0.12+0.02);g.gain.exponentialRampToValueAtTime(0.0001,now+i*0.12+1.2);
      o.connect(g);g.connect(rev);o.start(now+i*0.12);o.stop(now+i*0.12+1.5);
    });
  };
}

// ── Render ────────────────────────────────────────────────────
function drawScene(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,CW,CH);
  ctx.globalAlpha=fadeAlpha;
  ctx.lineCap='round';ctx.lineJoin='round';

  // Draw edges up to drawnEdge
  for(let i=0;i<drawnEdge&&i<N_CITIES;i++){
    const a=cities[bestTour[i]],b=cities[bestTour[(i+1)%N_CITIES]];
    const t=i/N_CITIES;
    const hue=200+t*120;
    ctx.strokeStyle=`hsla(${hue},100%,62%,0.88)`;
    ctx.lineWidth=2.8;
    ctx.shadowBlur=8;ctx.shadowColor=`hsl(${hue},100%,65%)`;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.shadowBlur=0;

  // Draw cities
  for(let i=0;i<N_CITIES;i++){
    const c=cities[i];
    const active=drawnEdge>i;
    ctx.fillStyle=active?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.25)';
    ctx.shadowBlur=active?14:0;ctx.shadowColor='rgba(140,220,255,0.9)';
    ctx.beginPath();ctx.arc(c.x,c.y,active?6:4,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;

  // Stats
  ctx.globalAlpha=fadeAlpha*0.85;
  ctx.fillStyle='rgba(140,220,255,0.9)';
  ctx.font='bold 30px monospace';ctx.textAlign='center';
  ctx.fillText(`Distance: ${Math.round(bestLen)} px   Pass: ${optPasses}`,CW/2,CH-24);
  ctx.globalAlpha=1;
}

// ── Game loop ─────────────────────────────────────────────────
const DRAW_INTERVAL=4; // frames between each new edge drawn — slower reveal
let frameCount=0;

function animate(){
  frameCount++;
  if(phase==='drawing'){
    if(frameCount%DRAW_INTERVAL===0) drawnEdge=Math.min(drawnEdge+1,N_CITIES);
    if(drawnEdge>=N_CITIES){phase='optimizing';phaseTimer=0;if(window.playComplete) window.playComplete();}
  } else if(phase==='optimizing'){
    // 1 opt pass every 8 frames — visually slower
    if(frameCount%8===0) twoOptPass();
    if(optPasses>=50){phase='hold';phaseTimer=0;}
  } else if(phase==='hold'){
    phaseTimer++;if(phaseTimer>180){phase='fade';phaseTimer=0;}
  } else if(phase==='fade'){
    phaseTimer++;fadeAlpha=Math.max(0,1-phaseTimer/60);
    if(phaseTimer>=60) initTour();
  }
  drawScene();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ── Audio unlock overlay ──────────────────────────────────────
(function(){
  const ov = document.createElement('div');
  ov.id = 'audioOverlay';
  ov.style.cssText = [
    'position:fixed','top:0','left:0','width:100%','height:100%',
    'display:flex','align-items:center','justify-content:center',
    'background:rgba(0,0,0,0.55)','z-index:9999','cursor:pointer',
    'flex-direction:column','gap:16px'
  ].join(';');
  const icon = document.createElement('div');
  icon.textContent = '🔊';
  icon.style.cssText = 'font-size:64px;';
  const txt = document.createElement('div');
  txt.textContent = 'Tap to enable sound';
  txt.style.cssText = [
    'font-family:"Cormorant Garamond",serif',
    'font-weight:300','letter-spacing:0.2em',
    'color:rgba(255,255,255,0.8)','font-size:22px'
  ].join(';');
  ov.appendChild(icon); ov.appendChild(txt);
  document.body.appendChild(ov);
  function unlock() {
    try { initAudio(); } catch(e) { console.error(e); }
    ov.style.opacity = '0';
    ov.style.transition = 'opacity 0.5s';
    setTimeout(() => ov.remove(), 600);
  }
  ov.addEventListener('click', unlock);
  ov.addEventListener('touchstart', unlock);
})();

