'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

// Fluid grid (Stable Fluids, Jos Stam)
const N=120,M=150;
const SZ=(N+2)*(M+2);
function idx(x,y){return x+(N+2)*y;}

// Use plain arrays — no pointer aliasing issues
function mkF(){return new Float32Array(SZ);}
let u=mkF(),v=mkF(),u_=mkF(),v_=mkF();
let r=mkF(),g=mkF(),b=mkF(),r_=mkF(),g_=mkF(),b_=mkF();

const VISC=0.000008,DT=0.15;

function setBnd(mode,x){
  for(let i=1;i<=N;i++){x[idx(0,i)]=mode===1?-x[idx(1,i)]:x[idx(1,i)];x[idx(N+1,i)]=mode===1?-x[idx(N,i)]:x[idx(N,i)];}
  for(let j=1;j<=M;j++){x[idx(j,0)]=mode===2?-x[idx(j,1)]:x[idx(j,1)];x[idx(j,M+1)]=mode===2?-x[idx(j,M)]:x[idx(j,M)];}
  x[idx(0,0)]=0.5*(x[idx(1,0)]+x[idx(0,1)]);
  x[idx(0,M+1)]=0.5*(x[idx(1,M+1)]+x[idx(0,M)]);
  x[idx(N+1,0)]=0.5*(x[idx(N,0)]+x[idx(N+1,1)]);
  x[idx(N+1,M+1)]=0.5*(x[idx(N,M+1)]+x[idx(N+1,M)]);
}

function linSolve(b,x,x0,a,c){
  const inv=1/c;
  for(let k=0;k<8;k++){
    for(let j=1;j<=M;j++)for(let i=1;i<=N;i++)
      x[idx(i,j)]=(x0[idx(i,j)]+a*(x[idx(i-1,j)]+x[idx(i+1,j)]+x[idx(i,j-1)]+x[idx(i,j+1)]))*inv;
    setBnd(b,x);
  }
}

function diffuse(mode,x,x0){const a=DT*VISC*N*M;linSolve(mode,x,x0,a,1+4*a);}

function advect(mode,d,d0,ux,vy){
  const dt0x=DT*N,dt0y=DT*M;
  for(let j=1;j<=M;j++){
    for(let i=1;i<=N;i++){
      let px=i-dt0x*ux[idx(i,j)];
      let py=j-dt0y*vy[idx(i,j)];
      px=Math.max(0.5,Math.min(N+0.5,px));
      py=Math.max(0.5,Math.min(M+0.5,py));
      const i0=px|0,i1=i0+1,j0=py|0,j1=j0+1;
      const s1=px-i0,s0=1-s1,t1=py-j0,t0=1-t1;
      d[idx(i,j)]=s0*(t0*d0[idx(i0,j0)]+t1*d0[idx(i0,j1)])+s1*(t0*d0[idx(i1,j0)]+t1*d0[idx(i1,j1)]);
    }
  }
  setBnd(mode,d);
}

function project(ux,vy,p,div){
  for(let j=1;j<=M;j++)for(let i=1;i<=N;i++){
    div[idx(i,j)]=-0.5*(ux[idx(i+1,j)]-ux[idx(i-1,j)]+vy[idx(i,j+1)]-vy[idx(i,j-1)]);
    p[idx(i,j)]=0;
  }
  setBnd(0,div);setBnd(0,p);
  linSolve(0,p,div,1,4);
  for(let j=1;j<=M;j++)for(let i=1;i<=N;i++){
    ux[idx(i,j)]-=0.5*(p[idx(i+1,j)]-p[idx(i-1,j)]);
    vy[idx(i,j)]-=0.5*(p[idx(i,j+1)]-p[idx(i,j-1)]);
  }
  setBnd(1,ux);setBnd(2,vy);
}

function velStep(){
  // add velocity into u_ v_ then diffuse into u v
  diffuse(1,u_,u);diffuse(2,v_,v);
  project(u_,v_,u,v);
  advect(1,u,u_,u_,v_);advect(2,v,v_,u_,v_);
  project(u,v,u_,v_);
}

function denStep(d,d0){
  advect(0,d,d0,u,v);
  for(let i=0;i<SZ;i++) d[i]*=0.993;
}

let ang=0;
function addSrc(){
  ang+=0.014;
  const cx=Math.round(N/2+Math.sin(ang)*N*0.3)|0;
  const cy=Math.round(M/2+Math.cos(ang*0.8)*M*0.25)|0;
  const spd=3.5,dir=ang+Math.PI/2;
  u[idx(cx,cy)]+=Math.cos(dir)*spd;
  v[idx(cx,cy)]+=Math.sin(dir)*spd;
  // copy current density to prev before adding so advect works on fresh source
  r_[idx(cx,cy)]=r[idx(cx,cy)];g_[idx(cx,cy)]=g[idx(cx,cy)];b_[idx(cx,cy)]=b[idx(cx,cy)];
  r[idx(cx,cy)]+=150;g[idx(cx,cy)]+=80+60*Math.sin(ang*2);b[idx(cx,cy)]+=200+50*Math.cos(ang*1.4);
  const cx2=N+1-cx,cy2=M+1-cy;
  u[idx(cx2,cy2)]-=Math.cos(dir)*spd;v[idx(cx2,cy2)]-=Math.sin(dir)*spd;
  r_[idx(cx2,cy2)]=r[idx(cx2,cy2)];g_[idx(cx2,cy2)]=g[idx(cx2,cy2)];b_[idx(cx2,cy2)]=b[idx(cx2,cy2)];
  r[idx(cx2,cy2)]+=80+50*Math.cos(ang);g[idx(cx2,cy2)]+=150;b[idx(cx2,cy2)]+=90+50*Math.sin(ang*1.8);
}

function copyTo(src,dst){for(let i=0;i<SZ;i++) dst[i]=src[i];}

function step(){
  addSrc();
  // save density prev
  copyTo(r,r_);copyTo(g,g_);copyTo(b,b_);
  velStep();
  denStep(r,r_);denStep(g,g_);denStep(b,b_);
}

const cellW=CW/N,cellH=CH/M;
function render(){
  ctx.fillStyle='#060608';ctx.fillRect(0,0,CW,CH);
  for(let j=1;j<=M;j++){
    for(let i=1;i<=N;i++){
      const rv=Math.min(255,r[idx(i,j)]*1.8)|0;
      const gv=Math.min(255,g[idx(i,j)]*1.8)|0;
      const bv=Math.min(255,b[idx(i,j)]*1.8)|0;
      if(rv<3&&gv<3&&bv<3) continue;
      ctx.fillStyle=`rgb(${rv},${gv},${bv})`;
      ctx.fillRect((i-1)*cellW|0,(j-1)*cellH|0,cellW+1|0,cellH+1|0);
    }
  }
}

// Audio
let aCtx=null;
function initAudio(){
  if(aCtx) return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();
  master.gain.setValueAtTime(0,aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.4,aCtx.currentTime+3);
  master.connect(aCtx.destination);
  // reverb
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*3,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.5);}
  const rev=aCtx.createConvolver();rev.buffer=rb;rev.connect(master);
  // fluid whoosh: filtered noise
  const nb=aCtx.createBuffer(1,aCtx.sampleRate*2,aCtx.sampleRate);
  const nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
  const ns=aCtx.createBufferSource();ns.buffer=nb;ns.loop=true;
  const lp=aCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=300;lp.Q.value=2;
  const ng=aCtx.createGain();ng.gain.value=0.35;
  ns.connect(lp);lp.connect(ng);ng.connect(rev);ns.start();
  // LFO swirl
  const lfo=aCtx.createOscillator();const lg=aCtx.createGain();
  lfo.frequency.value=0.3;lg.gain.value=200;lfo.connect(lg);lg.connect(lp.frequency);lfo.start();
  // drone
  [55,82.4,110].forEach((f,i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=f;g.gain.value=0.07-i*0.015;
    o.connect(g);g.connect(rev);o.start();
  });
  // periodic bubble/blip
  function blip(){
    const now=aCtx.currentTime;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=200+Math.random()*600;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.08,now+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,now+0.5);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+0.5);
    setTimeout(blip,400+Math.random()*1200);
  }
  setTimeout(blip,600);
}
document.addEventListener('click',initAudio,{once:true});
setTimeout(()=>{try{initAudio();}catch(e){}},500);

function animate(){step();render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
