'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

const N_CITIES=38;
const MARGIN=80;

function randCities(){
  const c=[];
  for(let i=0;i<N_CITIES;i++) c.push({x:MARGIN+Math.random()*(CW-MARGIN*2),y:MARGIN+Math.random()*(CH-MARGIN*2)});
  return c;
}

function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}

function tourLen(cities,tour){
  let d=0;for(let i=0;i<tour.length;i++) d+=dist(cities[tour[i]],cities[tour[(i+1)%tour.length]]);
  return d;
}

// 2-opt swap
function twoOpt(cities,tour){
  const n=tour.length;
  let improved=true,swaps=0;
  while(improved&&swaps<400){
    improved=false;
    for(let i=0;i<n-1&&!improved;i++){
      for(let j=i+2;j<n&&!improved;j++){
        if(j===0&&i===n-1) continue;
        const d0=dist(cities[tour[i]],cities[tour[i+1]])+dist(cities[tour[j]],cities[tour[(j+1)%n]]);
        const d1=dist(cities[tour[i]],cities[tour[j]])+dist(cities[tour[i+1]],cities[tour[(j+1)%n]]);
        if(d1<d0-0.001){
          // reverse i+1..j
          let a=i+1,b=j;while(a<b){const t=tour[a];tour[a]=tour[b];tour[b]=t;a++;b--;}
          improved=true;swaps++;
        }
      }
    }
  }
}

let cities=[],tour=[],bestLen=Infinity,bestTour=[];
let phase='building'; // building | optimizing | hold | fade | reset
let phaseTimer=0;
let globalAlpha=1;
let buildIdx=0;
let optSteps=0;

// Animated path drawing
let drawnEdge=0;

function reset(){
  cities=randCities();
  tour=Array.from({length:N_CITIES},(_,i)=>i);
  // nearest-neighbour init
  const visited=new Uint8Array(N_CITIES);
  tour[0]=0;visited[0]=1;
  for(let i=1;i<N_CITIES;i++){
    let best=-1,bd=Infinity;
    for(let j=0;j<N_CITIES;j++){
      if(!visited[j]){const d=dist(cities[tour[i-1]],cities[j]);if(d<bd){bd=d;best=j;}}
    }
    tour[i]=best;visited[best]=1;
  }
  bestLen=tourLen(cities,tour);
  bestTour=[...tour];
  phase='optimizing';
  phaseTimer=0;optSteps=0;drawnEdge=0;globalAlpha=1;
}

reset();

// Run 2-opt incrementally
function stepOpt(){
  // One pass of 2-opt
  const n=tour.length;
  for(let i=0;i<n-1;i++){
    for(let j=i+2;j<n;j++){
      if(j===0&&i===n-1) continue;
      const d0=dist(cities[tour[i]],cities[tour[i+1]])+dist(cities[tour[j]],cities[tour[(j+1)%n]]);
      const d1=dist(cities[tour[i]],cities[tour[j]])+dist(cities[tour[i+1]],cities[tour[(j+1)%n]]);
      if(d1<d0-0.001){
        let a=i+1,b=j;while(a<b){const t=tour[a];tour[a]=tour[b];tour[b]=t;a++;b--;}
      }
    }
  }
  const l=tourLen(cities,tour);
  if(l<bestLen){bestLen=l;bestTour=[...tour];}
  optSteps++;
}

function drawScene(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,CW,CH);

  ctx.globalAlpha=globalAlpha;

  // Draw current tour edges animating in
  const edgeEnd=Math.min(drawnEdge,N_CITIES);
  ctx.lineCap='round';ctx.lineJoin='round';

  for(let i=0;i<edgeEnd;i++){
    const a=cities[bestTour[i]],b=cities[bestTour[(i+1)%N_CITIES]];
    const t=i/N_CITIES;
    const hue=200+t*120;
    ctx.strokeStyle=`hsla(${hue},100%,65%,0.85)`;
    ctx.lineWidth=2.5;
    ctx.shadowBlur=8;ctx.shadowColor=`hsl(${hue},100%,70%)`;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.shadowBlur=0;

  // Draw cities
  for(let i=0;i<N_CITIES;i++){
    const c=cities[i];
    const isInPath=drawnEdge>i;
    ctx.fillStyle=isInPath?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.3)';
    ctx.shadowBlur=isInPath?12:0;ctx.shadowColor='rgba(150,220,255,0.9)';
    ctx.beginPath();ctx.arc(c.x,c.y,isInPath?5:3.5,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;

  // Distance label
  ctx.globalAlpha=globalAlpha*0.85;
  ctx.fillStyle='rgba(150,220,255,0.9)';
  ctx.font='bold 28px monospace';
  ctx.textAlign='left';
  ctx.fillText(`Tour: ${Math.round(bestLen)} px  |  Pass: ${optSteps}`,40,CH-20);

  ctx.globalAlpha=1;
}

// Audio
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();master.gain.setValueAtTime(0,aCtx.currentTime);master.gain.linearRampToValueAtTime(0.4,aCtx.currentTime+2);master.connect(aCtx.destination);
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*1.5,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.5);}
  const rev=aCtx.createConvolver();rev.buffer=rb;const rg=aCtx.createGain();rg.gain.value=0.45;rev.connect(rg);rg.connect(master);
  // algorithmic thinking hum
  [82.4,110,164.8].forEach((f,i)=>{const o=aCtx.createOscillator();const g=aCtx.createGain();o.type='triangle';o.frequency.value=f;g.gain.value=0.04-i*0.008;o.connect(g);g.connect(rev);o.start();});
  // tick per edge drawn
  function tick(){
    if(drawnEdge<N_CITIES){
      const now=aCtx.currentTime;
      const o=aCtx.createOscillator();const g=aCtx.createGain();
      o.type='sine';o.frequency.value=400+drawnEdge*18;
      g.gain.setValueAtTime(0.06,now);g.gain.exponentialRampToValueAtTime(0.0001,now+0.08);
      o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.1);
    }
    setTimeout(tick,55);
  }
  setTimeout(tick,300);
}
document.addEventListener('click',initAudio,{once:true});
setTimeout(()=>{try{initAudio();}catch(e){}},500);

function animate(){
  if(phase==='optimizing'){
    stepOpt();optSteps++;
    drawnEdge=Math.min(drawnEdge+1,N_CITIES);
    if(optSteps>=60){phase='hold';phaseTimer=0;drawnEdge=N_CITIES;}
  } else if(phase==='hold'){
    phaseTimer++;if(phaseTimer>160){phase='fade';phaseTimer=0;}
  } else if(phase==='fade'){
    phaseTimer++;globalAlpha=Math.max(0,1-phaseTimer/50);
    if(phaseTimer>=50){phase='reset';}
  } else if(phase==='reset'){
    reset();
  }
  drawScene();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
