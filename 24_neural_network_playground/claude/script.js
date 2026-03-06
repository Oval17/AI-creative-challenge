'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

// ── Network architecture ───────────────────────────────────────
const LAYERS=[2,5,5,3,1];
const LR=0.04;   // learning rate — reduced for slower convergence

// XOR-like training data
const DATA=[
  [[0,0],[0]],[[0,1],[1]],[[1,0],[1]],[[1,1],[0]],
  [[0.1,0.9],[0.9]],[[0.9,0.1],[0.9]],[[0.9,0.9],[0.1]],[[0.1,0.1],[0.1]]
];

function sigmoid(x){return 1/(1+Math.exp(-x));}
function sigmoidD(x){const s=sigmoid(x);return s*(1-s);}

// Init weights & biases
const weights=[],biases=[],zs=[],acts=[];
for(let l=0;l<LAYERS.length;l++){
  acts.push(new Float64Array(LAYERS[l]));
  zs.push(new Float64Array(LAYERS[l]));
  if(l>0){
    const w=[];
    for(let n=0;n<LAYERS[l];n++){
      const row=[];
      for(let p=0;p<LAYERS[l-1];p++) row.push((Math.random()-0.5)*1.5);
      w.push(row);
    }
    weights.push(w);
    biases.push(new Float64Array(LAYERS[l]).map(()=>(Math.random()-0.5)*0.5));
  } else {weights.push(null);biases.push(null);}
}

function forward(inp){
  for(let i=0;i<LAYERS[0];i++){acts[0][i]=inp[i];zs[0][i]=inp[i];}
  for(let l=1;l<LAYERS.length;l++){
    for(let n=0;n<LAYERS[l];n++){
      let z=biases[l][n];
      for(let p=0;p<LAYERS[l-1];p++) z+=weights[l][n][p]*acts[l-1][p];
      zs[l][n]=z; acts[l][n]=sigmoid(z);
    }
  }
  return acts[LAYERS.length-1][0];
}

function backward(target){
  const deltas=LAYERS.map(n=>new Float64Array(n));
  const last=LAYERS.length-1;
  for(let n=0;n<LAYERS[last];n++) deltas[last][n]=(acts[last][n]-target[n])*sigmoidD(zs[last][n]);
  for(let l=last-1;l>0;l--){
    for(let n=0;n<LAYERS[l];n++){
      let e=0;
      for(let k=0;k<LAYERS[l+1];k++) e+=deltas[l+1][k]*weights[l+1][k][n];
      deltas[l][n]=e*sigmoidD(zs[l][n]);
    }
  }
  for(let l=1;l<LAYERS.length;l++){
    for(let n=0;n<LAYERS[l];n++){
      biases[l][n]-=LR*deltas[l][n];
      for(let p=0;p<LAYERS[l-1];p++) weights[l][n][p]-=LR*deltas[l][n]*acts[l-1][p];
    }
  }
}

// ── Layout ─────────────────────────────────────────────────────
const PAD_X=120,PAD_Y=80;
const NET_W=CW-PAD_X*2,NET_H=CH-PAD_Y*2;
const nodePos=LAYERS.map((n,l)=>{
  const x=PAD_X+l*(NET_W/(LAYERS.length-1));
  return Array.from({length:n},(_,i)=>({x,y:PAD_Y+(i+0.5)*(NET_H/n)}));
});

// ── Signal particles ───────────────────────────────────────────
const particles=[];
let particleTimer=0;
function spawnParticle(){
  const d=DATA[Math.floor(Math.random()*DATA.length)];
  forward(d[0]);
  for(let l=0;l<LAYERS.length-1;l++){
    for(let a=0;a<LAYERS[l];a++){
      for(let b=0;b<LAYERS[l+1];b++){
        if(Math.random()<0.3){
          const w=Math.abs(weights[l+1][b][a]);
          particles.push({l,a,b,t:0,speed:0.004+Math.random()*0.003,w,act:acts[l][a]});
        }
      }
    }
  }
}

// ── Audio ──────────────────────────────────────────────────────
let aCtx=null,synthReady=false;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();
  master.gain.setValueAtTime(0,aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.5,aCtx.currentTime+3);
  master.connect(aCtx.destination);

  const rb=aCtx.createBuffer(2,aCtx.sampleRate*2,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.2);}
  const rev=aCtx.createConvolver();rev.buffer=rb;
  const rg=aCtx.createGain();rg.gain.value=0.5;rev.connect(rg);rg.connect(master);

  // Neural hum — soft ambient pad
  [110,165,220,330].forEach((f,i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=f;g.gain.value=0.05-i*0.01;
    const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
    lfo.frequency.value=0.15+i*0.07;lg.gain.value=f*0.004;
    lfo.connect(lg);lg.connect(o.frequency);lfo.start();
    o.connect(g);g.connect(rev);o.start();
  });

  synthReady=true;

  // Synapse fire — each particle triggers a tiny blip
  function fireBlip(){
    if(!synthReady) return;
    const now=aCtx.currentTime;
    const freq=300+Math.random()*600;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0.04,now);g.gain.exponentialRampToValueAtTime(0.0001,now+0.1);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.12);
    setTimeout(fireBlip,150+Math.random()*200);
  }
  setTimeout(fireBlip,500);

  // Loss descent beep — pitch lowers as network improves
  let prevLoss=1;
  function lossBeep(){
    const now=aCtx.currentTime;
    const [inp,tgt]=DATA[Math.floor(Math.random()*DATA.length)];
    const out=forward(inp);
    const loss=Math.abs(out-tgt[0]);
    const pitchDelta=prevLoss-loss;
    prevLoss=loss;
    const freq=pitchDelta>0?880:440;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='triangle';o.frequency.value=freq;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.05,now+0.01);g.gain.exponentialRampToValueAtTime(0.0001,now+0.5);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.55);
    setTimeout(lossBeep,1200+Math.random()*800);
  }
  setTimeout(lossBeep,1500);
}

// ── Render ─────────────────────────────────────────────────────
function drawNet(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,CW,CH);

  // Edges
  for(let l=1;l<LAYERS.length;l++){
    for(let n=0;n<LAYERS[l];n++){
      for(let p=0;p<LAYERS[l-1];p++){
        const w=weights[l][n][p];
        const a=nodePos[l-1][p],b=nodePos[l][n];
        const alpha=Math.min(0.8,Math.abs(w)*0.5+0.08);
        const hue=w>0?195:340;
        ctx.strokeStyle=`hsla(${hue},90%,60%,${alpha})`;
        ctx.lineWidth=Math.min(3,Math.abs(w)*1.2+0.3);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    }
  }

  // Particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.t+=p.speed;
    if(p.t>1){particles.splice(i,1);continue;}
    const a=nodePos[p.l][p.a],b=nodePos[p.l+1][p.b];
    const px=a.x+(b.x-a.x)*p.t,py=a.y+(b.y-a.y)*p.t;
    const br=Math.round(p.act*100);
    ctx.fillStyle=`hsl(180,100%,${br}%)`;
    ctx.shadowBlur=12;ctx.shadowColor='cyan';
    ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
  }

  // Nodes
  for(let l=0;l<LAYERS.length;l++){
    for(let n=0;n<LAYERS[l];n++){
      const{x,y}=nodePos[l][n];
      const act=acts[l][n];
      const hue=120+act*180;
      const br=30+act*50;
      ctx.shadowBlur=20;ctx.shadowColor=`hsl(${hue},100%,60%)`;
      ctx.fillStyle=`hsl(${hue},100%,${br}%)`;
      ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.stroke();
    }
  }
}

// ── Training loop — 1 sample per frame ────────────────────────
let epoch=0,loss=0;
let frame=0;
function animate(){
  frame++;
  // Train 1 sample every 2 frames — slower than every frame
  if(frame%2===0){
    const [inp,tgt]=DATA[epoch%DATA.length];
    forward(inp);
    backward(tgt);
    const out=acts[LAYERS.length-1][0];
    loss=loss*0.98+Math.abs(out-tgt[0])*0.02;
    epoch++;
  }
  // Spawn particles every 30 frames
  particleTimer++;
  if(particleTimer%30===0) spawnParticle();

  drawNet();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
document.addEventListener('click', function(){ try{initAudio();}catch(e){} }, {once:true});
document.addEventListener('touchstart', function(){ try{initAudio();}catch(e){} }, {once:true});
