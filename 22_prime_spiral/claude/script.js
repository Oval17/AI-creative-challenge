'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

// Sieve of Eratosthenes
const MAX=80000;
const sieve=new Uint8Array(MAX+1);
sieve[0]=sieve[1]=1;
for(let i=2;i*i<=MAX;i++) if(!sieve[i]) for(let j=i*i;j<=MAX;j+=i) sieve[j]=1;
function isPrime(n){return n>=2&&!sieve[n];}

// Ulam spiral: map integer n to (x,y) via spiral walk
function spiralXY(n){
  if(n===0)return[0,0];
  let x=0,y=0,dx=1,dy=0,seg=1,segCount=0,steps=0;
  for(let i=1;i<=n;i++){
    x+=dx;y+=dy;steps++;
    if(steps===seg){
      steps=0;const tmp=dx;dx=-dy;dy=tmp;segCount++;
      if(segCount%2===0)seg++;
    }
  }
  return[x,y];
}

// Pre-compute spiral positions up to MAX_DRAW
const MAX_DRAW=12000;
const pts=[];
for(let n=0;n<=MAX_DRAW;n++){
  const[x,y]=spiralXY(n);
  pts.push({x,y,prime:isPrime(n),n});
}

// Find bounds
let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
for(const p of pts){if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}
const spanX=maxX-minX,spanY=maxY-minY;
const margin=60;
const scale=Math.min((CW-margin*2)/spanX,(CH-margin*2)/spanY);
const ox=CW/2-(minX+spanX/2)*scale;
const oy=CH/2-(minY+spanY/2)*scale;

function toScreen(x,y){return[x*scale+ox,y*scale+oy];}

// Animation state
let revealed=0;
const REVEAL_PER_FRAME=18;
let glowPhase=0;

// Off-screen for trails
const offC=document.createElement('canvas');offC.width=CW;offC.height=CH;
const offCtx=offC.getContext('2d');
offCtx.fillStyle='#060608';offCtx.fillRect(0,0,CW,CH);

function drawPoint(p,bright){
  const[sx,sy]=toScreen(p.x,p.y);
  if(p.prime){
    const hue=180+((p.n/MAX_DRAW)*120);
    const alpha=bright?1:0.75;
    if(bright){
      offCtx.shadowBlur=8;offCtx.shadowColor=`hsl(${hue},100%,70%)`;
    }
    offCtx.fillStyle=`hsla(${hue},100%,${bright?80:65}%,${alpha})`;
    offCtx.beginPath();offCtx.arc(sx,sy,scale*0.38,0,Math.PI*2);offCtx.fill();
    offCtx.shadowBlur=0;
  } else {
    offCtx.fillStyle='rgba(255,255,255,0.08)';
    offCtx.fillRect(sx-scale*0.18,sy-scale*0.18,scale*0.36,scale*0.36);
  }
}

function render(){
  // Reveal new points
  const end=Math.min(revealed+REVEAL_PER_FRAME,MAX_DRAW);
  for(let i=revealed;i<end;i++) drawPoint(pts[i],true);
  revealed=end;

  // If fully revealed, restart with fade
  if(revealed>=MAX_DRAW){
    offCtx.fillStyle='rgba(6,6,8,0.004)';
    offCtx.fillRect(0,0,CW,CH);
    // Glow pulse on primes
    glowPhase+=0.025;
    const pCycle=Math.floor(glowPhase*8)%MAX_DRAW;
    const p=pts[pCycle];
    if(p&&p.prime)drawPoint(p,true);
  }

  ctx.drawImage(offC,0,0);

  // Subtle vignette
  const vig=ctx.createRadialGradient(CW/2,CH/2,CH*0.3,CW/2,CH/2,CH*0.75);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,CW,CH);
}

// Audio
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();master.gain.setValueAtTime(0,aCtx.currentTime);master.gain.linearRampToValueAtTime(0.45,aCtx.currentTime+2.5);master.connect(aCtx.destination);
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*2.5,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.2);}
  const rev=aCtx.createConvolver();rev.buffer=rb;const rg=aCtx.createGain();rg.gain.value=0.5;rev.connect(rg);rg.connect(master);
  // cosmic pad
  [110,164.8,220,329.6].forEach((f,i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=f;g.gain.value=0.06-i*0.01;
    const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
    lfo.frequency.value=0.1+i*0.07;lg.gain.value=f*0.004;
    lfo.connect(lg);lg.connect(o.frequency);lfo.start();
    o.connect(g);g.connect(rev);o.start();
  });
  // prime "ping" on reveal
  let pingIdx=0;
  function ping(){
    const now=aCtx.currentTime;
    while(pingIdx<revealed&&pingIdx<MAX_DRAW){
      if(pts[pingIdx].prime){
        const freq=200+pts[pingIdx].n*0.8;
        const o=aCtx.createOscillator();const g=aCtx.createGain();
        o.type='sine';o.frequency.value=Math.min(freq,2000);
        g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.04,now+0.005);g.gain.exponentialRampToValueAtTime(0.0001,now+0.35);
        o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.4);
        pingIdx+=40;break;
      }
      pingIdx++;
    }
    setTimeout(ping,80);
  }
  setTimeout(ping,500);
}
document.addEventListener('click',initAudio,{once:true});
setTimeout(()=>{try{initAudio();}catch(e){}},500);

function animate(){render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
