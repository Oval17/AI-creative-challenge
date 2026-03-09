'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

const cx=CW/2,cy=CH/2;

// ── Star field ────────────────────────────────────────────────
const STARS=Array.from({length:320},()=>({
  x:Math.random()*CW,y:Math.random()*CH,
  r:Math.random()*1.3+0.2,
  alpha:Math.random()*0.7+0.2,
  tw:Math.random()*0.02+0.005,
  to:Math.random()*Math.PI*2,
}));

// ── Asteroid belt ─────────────────────────────────────────────
const ASTEROIDS=Array.from({length:180},()=>{
  const r=215+Math.random()*42;
  return{angle:Math.random()*Math.PI*2,radius:r,
    speed:0.00028+Math.random()*0.00012,
    size:Math.random()*1.6+0.3,
    alpha:Math.random()*0.45+0.18};
});

// ── Planets ───────────────────────────────────────────────────
const PLANETS=[
  {name:'Mercury',orbitR:58, speed:0.0220,size:5, color:'#b5b5b5',gr:[181,181,181],angle:Math.random()*Math.PI*2,trail:[]},
  {name:'Venus',  orbitR:90, speed:0.0145,size:8, color:'#e8c97a',gr:[232,201,122],angle:Math.random()*Math.PI*2,trail:[]},
  {name:'Earth',  orbitR:125,speed:0.0110,size:9, color:'#4a9eff',gr:[74,158,255], angle:Math.random()*Math.PI*2,trail:[]},
  {name:'Mars',   orbitR:162,speed:0.0086,size:6, color:'#e05c3a',gr:[224,92,58],  angle:Math.random()*Math.PI*2,trail:[]},
  {name:'Jupiter',orbitR:295,speed:0.0042,size:20,color:'#c8a96e',gr:[200,169,110],angle:Math.random()*Math.PI*2,trail:[],bands:true},
  {name:'Saturn', orbitR:375,speed:0.0030,size:16,color:'#e8d8a0',gr:[232,216,160],angle:Math.random()*Math.PI*2,trail:[],rings:true},
  {name:'Uranus', orbitR:440,speed:0.0021,size:11,color:'#7de8e8',gr:[125,232,232],angle:Math.random()*Math.PI*2,trail:[]},
  {name:'Neptune',orbitR:500,speed:0.0016,size:10,color:'#4060ff',gr:[64,96,255],  angle:Math.random()*Math.PI*2,trail:[]},
];
const MAX_TRAIL=55;

let t=0;

function drawOrbit(r,al){
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.strokeStyle=`rgba(255,255,255,${al})`;ctx.lineWidth=0.5;ctx.stroke();
}

function drawSun(){
  const pulse=1+Math.sin(t*1.8)*0.06;
  const corona=ctx.createRadialGradient(cx,cy,0,cx,cy,62*pulse);
  corona.addColorStop(0,'rgba(255,240,180,0)');
  corona.addColorStop(0.3,'rgba(255,200,60,0.09)');
  corona.addColorStop(1,'rgba(255,120,0,0)');
  ctx.fillStyle=corona;ctx.beginPath();ctx.arc(cx,cy,62*pulse,0,Math.PI*2);ctx.fill();
  const sg=ctx.createRadialGradient(cx,cy,0,cx,cy,34);
  sg.addColorStop(0,'#fff8e0');sg.addColorStop(0.3,'#ffe060');
  sg.addColorStop(0.7,'#ff8800');sg.addColorStop(1,'rgba(255,80,0,0)');
  ctx.fillStyle=sg;ctx.beginPath();ctx.arc(cx,cy,34,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff5c0';ctx.beginPath();ctx.arc(cx,cy,18,0,Math.PI*2);ctx.fill();
}

function drawJupiterBands(px,py,size){
  ctx.save();ctx.beginPath();ctx.arc(px,py,size,0,Math.PI*2);ctx.clip();
  ['#c8a96e','#b8915a','#d4b880','#a07840'].forEach((c,i)=>{
    ctx.fillStyle=c;
    ctx.fillRect(px-size,py-size+(i/4)*size*2,size*2,size*0.52);
  });ctx.restore();
}

function drawSaturnRings(px,py,size,angle){
  ctx.save();ctx.translate(px,py);ctx.rotate(angle+Math.PI*0.15);
  [[2.5,0.50,5,'rgba(220,200,140,0.55)'],[1.95,0.40,3,'rgba(200,180,120,0.40)'],[1.5,0.30,2,'rgba(180,160,100,0.25)']].forEach(([rx,ry,lw,col])=>{
    ctx.beginPath();ctx.ellipse(0,0,size*rx,size*ry,0,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.stroke();
  });ctx.restore();
}

function render(){
  ctx.fillStyle='#050505';ctx.fillRect(0,0,CW,CH);

  // Stars
  STARS.forEach(s=>{
    const al=s.alpha*(0.6+0.4*Math.sin(t*s.tw*60+s.to));
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,255,255,${al})`;ctx.fill();
  });

  // Orbits
  PLANETS.forEach(p=>drawOrbit(p.orbitR,0.11));
  drawOrbit(215,0.04);drawOrbit(257,0.04);

  // Asteroids
  ASTEROIDS.forEach(a=>{
    a.angle+=a.speed;
    const x=cx+Math.cos(a.angle)*a.radius,y=cy+Math.sin(a.angle)*a.radius;
    ctx.beginPath();ctx.arc(x,y,a.size,0,Math.PI*2);
    ctx.fillStyle=`rgba(150,135,115,${a.alpha})`;ctx.fill();
  });

  drawSun();

  PLANETS.forEach(p=>{
    p.angle+=p.speed;
    const px=cx+Math.cos(p.angle)*p.orbitR;
    const py=cy+Math.sin(p.angle)*p.orbitR;
    p.trail.push({x:px,y:py});
    if(p.trail.length>MAX_TRAIL) p.trail.shift();

    // Trail
    if(p.trail.length>2){
      for(let i=1;i<p.trail.length;i++){
        const al=(i/p.trail.length)*0.30;
        ctx.beginPath();ctx.moveTo(p.trail[i-1].x,p.trail[i-1].y);ctx.lineTo(p.trail[i].x,p.trail[i].y);
        ctx.strokeStyle=`rgba(${p.gr[0]},${p.gr[1]},${p.gr[2]},${al})`;
        ctx.lineWidth=p.size*0.22;ctx.stroke();
      }
    }

    if(p.rings) drawSaturnRings(px,py,p.size,p.angle);

    // Glow
    const pg=ctx.createRadialGradient(px,py,0,px,py,p.size*3);
    pg.addColorStop(0,`rgba(${p.gr[0]},${p.gr[1]},${p.gr[2]},0.35)`);
    pg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,p.size*3,0,Math.PI*2);ctx.fill();

    // Body
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(px,py,p.size,0,Math.PI*2);ctx.fill();
    if(p.bands) drawJupiterBands(px,py,p.size);

    // Shine
    const sh=ctx.createRadialGradient(px-p.size*0.3,py-p.size*0.3,0,px,py,p.size);
    sh.addColorStop(0,'rgba(255,255,255,0.45)');sh.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=sh;ctx.beginPath();ctx.arc(px,py,p.size,0,Math.PI*2);ctx.fill();
  });

  // Vignette
  const vg=ctx.createRadialGradient(cx,cy,CH*0.30,cx,cy,CH*0.58);
  vg.addColorStop(0,'rgba(5,5,5,0)');vg.addColorStop(1,'rgba(5,5,5,0.72)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,CW,CH);

  t+=0.016;
}

// ── Audio ─────────────────────────────────────────────────────
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();
  master.gain.setValueAtTime(0,aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.90,aCtx.currentTime+3);
  const comp=aCtx.createDynamicsCompressor();
  comp.threshold.value=-12;comp.knee.value=8;comp.ratio.value=6;
  comp.attack.value=0.003;comp.release.value=0.12;
  master.connect(comp);comp.connect(aCtx.destination);

  // Reverb
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*4,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.6);}
  const rev=aCtx.createConvolver();rev.buffer=rb;
  const rg=aCtx.createGain();rg.gain.value=0.88;rev.connect(rg);rg.connect(master);

  // Deep space drones – cosmic organ chords
  [[55,0.08,'sine'],[82.4,0.05,'sine'],[110,0.04,'triangle'],[41.2,0.06,'sine']].forEach(([freq,vol,type],i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type=type;o.frequency.value=freq;g.gain.value=vol;
    const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
    lfo.frequency.value=0.03+i*0.02;lg.gain.value=freq*0.008;
    lfo.connect(lg);lg.connect(o.frequency);lfo.start();
    o.connect(g);g.connect(rev);o.start();
  });

  // Cosmic wind noise
  const nb=aCtx.createBuffer(1,aCtx.sampleRate*3,aCtx.sampleRate);
  const nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=aCtx.createBufferSource();ns.buffer=nb;ns.loop=true;
  const lp=aCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=180;lp.Q.value=3;
  const ng=aCtx.createGain();ng.gain.value=0.06;
  ns.connect(lp);lp.connect(ng);ng.connect(rev);ns.start();

  // Orbital chime – periodic soft bell
  function chime(){
    const now=aCtx.currentTime;
    const freqs=[523.25,659.25,783.99,1046.5];
    const freq=freqs[Math.floor(Math.random()*freqs.length)];
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.14,now+0.08);
    g.gain.exponentialRampToValueAtTime(0.0001,now+2.5);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+2.6);
    setTimeout(chime,1500+Math.random()*3000);
  }
  setTimeout(chime,1000);
}

// ── Loop ──────────────────────────────────────────────────────
function animate(){render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
document.addEventListener('click',function(){try{initAudio();}catch(e){}},{once:true});
document.addEventListener('touchstart',function(){try{initAudio();}catch(e){}},{once:true});
