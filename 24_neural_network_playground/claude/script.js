'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

// Network architecture: [2, 6, 6, 4, 1]
const LAYERS=[2,6,6,4,1];
const NL=LAYERS.length;

// Sigmoid
function sig(x){return 1/(1+Math.exp(-x));}
function sigD(x){const s=sig(x);return s*(1-s);}

// Init weights & biases
function randW(){return(Math.random()-0.5)*2;}
const weights=[]; // weights[l][j][i] = w from layer l neuron i to layer l+1 neuron j
const biases=[];  // biases[l][j]
for(let l=0;l<NL-1;l++){
  const rows=LAYERS[l+1],cols=LAYERS[l];
  weights.push(Array.from({length:rows},()=>Array.from({length:cols},randW)));
  biases.push(Array.from({length:rows},randW));
}

// Activations
const acts=LAYERS.map(n=>new Float32Array(n));
const zvals=LAYERS.map(n=>new Float32Array(n));

function forward(input){
  for(let i=0;i<input.length;i++) acts[0][i]=input[i];
  for(let l=0;l<NL-1;l++){
    for(let j=0;j<LAYERS[l+1];j++){
      let z=biases[l][j];
      for(let i=0;i<LAYERS[l];i++) z+=weights[l][j][i]*acts[l][i];
      zvals[l+1][j]=z;
      acts[l+1][j]=sig(z);
    }
  }
  return acts[NL-1][0];
}

// Backprop (XOR-like task, 2 inputs → 1 output)
const TRAIN=[[0,0,0],[1,0,1],[0,1,1],[1,1,0]];
const LR=0.08;
const deltas=LAYERS.map(n=>new Float32Array(n));

function backprop(inp,target){
  forward(inp);
  const out=acts[NL-1][0];
  deltas[NL-1][0]=(out-target)*sigD(zvals[NL-1][0]);
  for(let l=NL-2;l>=1;l--){
    for(let i=0;i<LAYERS[l];i++){
      let e=0;
      for(let j=0;j<LAYERS[l+1];j++) e+=weights[l][j][i]*deltas[l+1][j];
      deltas[l][i]=e*sigD(zvals[l][i]);
    }
  }
  for(let l=0;l<NL-1;l++){
    for(let j=0;j<LAYERS[l+1];j++){
      biases[l][j]-=LR*deltas[l+1][j];
      for(let i=0;i<LAYERS[l];i++) weights[l][j][i]-=LR*deltas[l+1][j]*acts[l][i];
    }
  }
}

let epoch=0;
const MAX_EPOCHS=8000;

// Layout: evenly space nodes
function nodePos(layer,node){
  const xStep=CW/(NL+1);
  const x=(layer+1)*xStep;
  const yStep=CH/(LAYERS[layer]+1);
  const y=(node+1)*yStep;
  return[x,y];
}

// Signal particles flowing along edges
const particles=[];
function spawnParticles(){
  for(let l=0;l<NL-1;l++){
    for(let j=0;j<LAYERS[l+1];j++){
      for(let i=0;i<LAYERS[l];i++){
        if(Math.random()<0.04){
          const w=weights[l][j][i];
          particles.push({l,j,i,t:Math.random(),speed:0.008+Math.random()*0.012,w});
        }
      }
    }
  }
}

function drawScene(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,CW,CH);

  // Draw edges (weights)
  for(let l=0;l<NL-1;l++){
    for(let j=0;j<LAYERS[l+1];j++){
      for(let i=0;i<LAYERS[l];i++){
        const[x1,y1]=nodePos(l,i);
        const[x2,y2]=nodePos(l+1,j);
        const w=weights[l][j][i];
        const norm=Math.tanh(Math.abs(w));
        const hue=w>0?195:340;
        ctx.strokeStyle=`hsla(${hue},90%,60%,${norm*0.45+0.05})`;
        ctx.lineWidth=norm*2.5+0.5;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      }
    }
  }

  // Draw signal particles
  for(const p of particles){
    const[x1,y1]=nodePos(p.l,p.i);
    const[x2,y2]=nodePos(p.l+1,p.j);
    const px=x1+(x2-x1)*p.t,py=y1+(y2-y1)*p.t;
    const hue=p.w>0?180:320;
    ctx.fillStyle=`hsla(${hue},100%,75%,${0.6+p.t*0.4})`;
    ctx.shadowBlur=10;ctx.shadowColor=`hsl(${hue},100%,70%)`;
    ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;

  // Draw nodes
  for(let l=0;l<NL;l++){
    for(let n=0;n<LAYERS[l];n++){
      const[x,y]=nodePos(l,n);
      const act=acts[l][n];
      const hue=200+act*120;
      const bright=30+act*60;

      // Glow
      const grd=ctx.createRadialGradient(x,y,0,x,y,28);
      grd.addColorStop(0,`hsla(${hue},100%,${bright+20}%,${act*0.5+0.1})`);
      grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grd;ctx.fillRect(x-28,y-28,56,56);

      // Node circle
      ctx.strokeStyle=`hsl(${hue},90%,${bright+10}%)`;
      ctx.lineWidth=2;
      ctx.fillStyle=`hsl(${hue},80%,${bright}%)`;
      ctx.shadowBlur=14;ctx.shadowColor=`hsl(${hue},100%,70%)`;
      ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.shadowBlur=0;

      // Activation value text
      ctx.fillStyle='rgba(255,255,255,0.75)';
      ctx.font='16px monospace';ctx.textAlign='center';
      ctx.fillText(act.toFixed(2),x,y+4);
    }
  }

  // Epoch + loss
  const lastOut=forward([Math.sin(epoch*0.1)*0.5+0.5,Math.cos(epoch*0.07)*0.5+0.5]);
  ctx.fillStyle='rgba(150,220,255,0.8)';
  ctx.font='bold 26px monospace';ctx.textAlign='left';
  ctx.fillText(`Epoch: ${epoch}  |  Output: ${lastOut.toFixed(4)}`,30,CH-16);
}

// Audio
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();master.gain.setValueAtTime(0,aCtx.currentTime);master.gain.linearRampToValueAtTime(0.38,aCtx.currentTime+2);master.connect(aCtx.destination);
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*2,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);}
  const rev=aCtx.createConvolver();rev.buffer=rb;const rg=aCtx.createGain();rg.gain.value=0.4;rev.connect(rg);rg.connect(master);
  // neural hum — FM synthesis
  const car=aCtx.createOscillator();const carG=aCtx.createGain();
  car.type='sine';car.frequency.value=110;carG.gain.value=0.06;
  const mod=aCtx.createOscillator();const modG=aCtx.createGain();
  mod.type='sine';mod.frequency.value=220;modG.gain.value=40;
  mod.connect(modG);modG.connect(car.frequency);
  car.connect(carG);carG.connect(rev);car.start();mod.start();
  // training blips
  function blip(){
    const now=aCtx.currentTime;
    const freq=300+Math.random()*700;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0.05,now);g.gain.exponentialRampToValueAtTime(0.0001,now+0.12);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.15);
    setTimeout(blip,120+Math.random()*250);
  }
  setTimeout(blip,200);
}
document.addEventListener('click',initAudio,{once:true});
setTimeout(()=>{try{initAudio();}catch(e){}},500);

function animate(){
  // Train several steps per frame
  for(let k=0;k<8;k++){
    const sample=TRAIN[epoch%TRAIN.length];
    backprop([sample[0],sample[1]],sample[2]);
    epoch++;
    if(epoch>MAX_EPOCHS){
      // Re-randomise weights to restart
      for(let l=0;l<NL-1;l++){
        for(let j=0;j<LAYERS[l+1];j++){biases[l][j]=randW();for(let i=0;i<LAYERS[l];i++) weights[l][j][i]=randW();}
      }
      epoch=0;
    }
  }
  // Update particles
  for(let p=particles.length-1;p>=0;p--){
    particles[p].t+=particles[p].speed;
    if(particles[p].t>=1) particles.splice(p,1);
  }
  spawnParticles();
  if(particles.length>200) particles.splice(0,particles.length-200);

  // Run a forward pass for display
  const s=TRAIN[epoch%TRAIN.length];
  forward([s[0],s[1]]);

  drawScene();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
