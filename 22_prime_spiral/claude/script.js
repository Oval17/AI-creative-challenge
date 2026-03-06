'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

// ── Sieve of Eratosthenes ─────────────────────────────────────
const MAX_N=12000;
const isPrime=new Uint8Array(MAX_N+1);
isPrime.fill(1);
isPrime[0]=isPrime[1]=0;
for(let i=2;i*i<=MAX_N;i++) if(isPrime[i]) for(let j=i*i;j<=MAX_N;j+=i) isPrime[j]=0;

// ── Ulam spiral: n → (col, row) ──────────────────────────────
// Use the mathematical formula instead of iteration to avoid bugs
function spiralPos(n){
  if(n===0) return [0,0];
  // layer = ceil((sqrt(n)-1)/2)
  const layer=Math.ceil((Math.sqrt(n)-1)/2);
  const legLen=2*layer;
  const start=(2*layer-1)*(2*layer-1)+1; // first n in this layer
  const pos=n-start;
  const side=Math.floor(pos/legLen);
  const offset=pos%legLen;
  switch(side){
    case 0: return [layer,  -layer+1+offset];   // right
    case 1: return [layer-1-offset, layer];      // top
    case 2: return [-layer, layer-1-offset];     // left
    case 3: return [-layer+1+offset, -layer];    // bottom
    default: return [0,0];
  }
}

// ── Pre-compute all points ────────────────────────────────────
const pts=[];
let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
for(let n=0;n<=MAX_N;n++){
  const[cx,cy]=spiralPos(n);
  pts.push({cx,cy,prime:isPrime[n]===1,n});
  if(cx<minX)minX=cx; if(cx>maxX)maxX=cx;
  if(cy<minY)minY=cy; if(cy>maxY)maxY=cy;
}

const spanX=maxX-minX+1, spanY=maxY-minY+1;
const margin=50;
const cellW=(CW-margin*2)/spanX;
const cellH=(CH-margin*2)/spanY;
const CELL=Math.min(cellW,cellH);
const ox=CW/2-(minX+spanX/2)*CELL;
const oy=CH/2-(minY+spanY/2)*CELL;
function toScreen(cx,cy){return[cx*CELL+ox, cy*CELL+oy];}

// ── Off-screen canvas for persistent drawing ──────────────────
const off=document.createElement('canvas');off.width=CW;off.height=CH;
const offCtx=off.getContext('2d');
offCtx.fillStyle='#050508';offCtx.fillRect(0,0,CW,CH);

// ── Animation state ───────────────────────────────────────────
let revealed=0;
const SPEED=6;  // points per frame — slow reveal
let glowT=0;
let phase='reveal'; // reveal | pulse

function drawPoint(p, bright){
  const[sx,sy]=toScreen(p.cx,p.cy);
  const r=Math.max(CELL*0.32,1.2);
  if(p.prime){
    const hue=185+((p.n/MAX_N)*110); // cyan to purple
    offCtx.shadowBlur=bright?10:0;
    offCtx.shadowColor=`hsl(${hue},100%,70%)`;
    offCtx.fillStyle=`hsl(${hue},100%,${bright?82:65}%)`;
    offCtx.beginPath();offCtx.arc(sx,sy,r,0,Math.PI*2);offCtx.fill();
    offCtx.shadowBlur=0;
  } else {
    offCtx.fillStyle='rgba(255,255,255,0.07)';
    offCtx.fillRect(sx-r*0.5,sy-r*0.5,r,r);
  }
}

// ── Audio: cosmic/mathematical ambience ──────────────────────
let aCtx=null,pingReady=false,revIdx=0;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();
  master.gain.setValueAtTime(0,aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.5,aCtx.currentTime+3);
  master.connect(aCtx.destination);

  // Reverb
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*2.5,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);}
  const rev=aCtx.createConvolver();rev.buffer=rb;
  const rg=aCtx.createGain();rg.gain.value=0.6;rev.connect(rg);rg.connect(master);

  // Cosmic drone — low hum of the universe
  [55,110,165].forEach((f,i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=f;g.gain.value=0.06-i*0.015;
    const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
    lfo.frequency.value=0.08+i*0.04;lg.gain.value=f*0.005;
    lfo.connect(lg);lg.connect(o.frequency);lfo.start();
    o.connect(g);g.connect(rev);o.start();
  });

  // Prime "chime" — a soft bell tone each time a prime is revealed
  pingReady=true;
  function schedulePing(){
    if(!pingReady||!aCtx) return;
    // Find next prime in revealed range
    while(revIdx<revealed){
      if(pts[revIdx]&&pts[revIdx].prime){
        const now=aCtx.currentTime;
        const freq=200+(revIdx/MAX_N)*800; // rising pitch as primes grow
        const o=aCtx.createOscillator();const g=aCtx.createGain();
        o.type='sine';o.frequency.value=Math.min(freq,2200);
        g.gain.setValueAtTime(0,now);
        g.gain.linearRampToValueAtTime(0.07,now+0.015);
        g.gain.exponentialRampToValueAtTime(0.0001,now+0.8);
        o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.85);
        revIdx+=50; // skip ahead so pings don't pile up
        break;
      }
      revIdx++;
    }
    setTimeout(schedulePing,120);
  }
  setTimeout(schedulePing,400);

  // Occasional deep "number theory" resonance tone
  function resonate(){
    const now=aCtx.currentTime;
    const f=[220,330,440,550,660][Math.floor(Math.random()*5)];
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='triangle';o.frequency.value=f;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.05,now+0.1);g.gain.exponentialRampToValueAtTime(0.0001,now+3);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+3.5);
    setTimeout(resonate,3000+Math.random()*4000);
  }
  setTimeout(resonate,2000);
}

// ── Main loop ─────────────────────────────────────────────────
function render(){
  if(phase==='reveal'){
    const end=Math.min(revealed+SPEED,MAX_N);
    for(let i=revealed;i<end;i++) drawPoint(pts[i],true);
    revealed=end;
    if(revealed>=MAX_N) phase='pulse';
  } else {
    // Pulse phase: gently re-glow primes in wave pattern
    glowT+=0.015;
    offCtx.fillStyle='rgba(5,5,8,0.003)';
    offCtx.fillRect(0,0,CW,CH);
    const wave=Math.floor((glowT%1)*MAX_N);
    for(let k=0;k<30;k++){
      const idx=(wave+k*400)%MAX_N;
      if(pts[idx]&&pts[idx].prime) drawPoint(pts[idx],true);
    }
  }

  ctx.drawImage(off,0,0);

  // Vignette
  const vig=ctx.createRadialGradient(CW/2,CH/2,CH*0.28,CW/2,CH/2,CH*0.72);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.6)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,CW,CH);
}

function animate(){render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
document.addEventListener('click', function(){ try{initAudio();}catch(e){} }, {once:true});
document.addEventListener('touchstart', function(){ try{initAudio();}catch(e){} }, {once:true});
