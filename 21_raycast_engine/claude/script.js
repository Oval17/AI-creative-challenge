'use strict';
const W=1080,H=1920;
const wrapper=document.querySelector('.wrapper');
function scaleWrapper(){const s=Math.min(window.innerWidth/W,window.innerHeight/H);wrapper.style.transform=`scale(${s})`;wrapper.style.left=((window.innerWidth-W*s)/2)+'px';wrapper.style.top=((window.innerHeight-H*s)/2)+'px';}
scaleWrapper();window.addEventListener('resize',scaleWrapper);

const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
const CW=1060,CH=1340;
canvas.width=CW;canvas.height=CH;

const MAP=[
  '################',
  '#..............#',
  '#.####.#.####.##',
  '#.#....#....#..#',
  '#.#.##.####.#..#',
  '#...#......#...#',
  '###.#.####.#.###',
  '#...#......#...#',
  '#.###.####.###.#',
  '#.#............#',
  '#.#.########.#.#',
  '#...#......#...#',
  '#.###.####.###.#',
  '#..............#',
  '################',
];
const MW=MAP[0].length,MH=MAP.length;
function isWall(x,y){const mx=x|0,my=y|0;if(mx<0||mx>=MW||my<0||my>=MH)return true;return MAP[my][mx]==='#';}

// Slower player speed
const player={x:1.5,y:1.5,angle:0,speed:0.010};
const FOV=Math.PI/2.5;
const RAYS=CW;
const HALF_H=CH/2;

const WALL_HUE=[[195,100,60],[280,90,55],[340,100,58],[50,100,55],[150,90,55]];
function wallColor(dist,side,mapX,mapY){
  const hi=(mapX+mapY)%WALL_HUE.length;
  const [h,s,l]=WALL_HUE[hi];
  const bright=Math.max(10,Math.min(l,l-dist*4+(side?-8:0)));
  return `hsl(${h},${s}%,${bright}%)`;
}

let floorGrad=null;
function makeGrads(){
  floorGrad=ctx.createLinearGradient(0,HALF_H,0,CH);
  floorGrad.addColorStop(0,'#0a0a12');
  floorGrad.addColorStop(1,'#050508');
}
makeGrads();

const MM_SCALE=18,MM_X=CW-MW*MM_SCALE-20,MM_Y=20;
function drawMinimap(){
  ctx.globalAlpha=0.55;
  for(let y=0;y<MH;y++){
    for(let x=0;x<MW;x++){
      ctx.fillStyle=MAP[y][x]==='#'?'rgba(100,200,255,0.7)':'rgba(0,0,0,0.4)';
      ctx.fillRect(MM_X+x*MM_SCALE,MM_Y+y*MM_SCALE,MM_SCALE-1,MM_SCALE-1);
    }
  }
  ctx.fillStyle='#ff4466';
  ctx.beginPath();ctx.arc(MM_X+player.x*MM_SCALE,MM_Y+player.y*MM_SCALE,4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ff4466';ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(MM_X+player.x*MM_SCALE,MM_Y+player.y*MM_SCALE);
  ctx.lineTo(MM_X+(player.x+Math.cos(player.angle)*1.5)*MM_SCALE,MM_Y+(player.y+Math.sin(player.angle)*1.5)*MM_SCALE);
  ctx.stroke();
  ctx.globalAlpha=1;
}

function cast(angle){
  const cos=Math.cos(angle),sin=Math.sin(angle);
  let mapX=player.x|0,mapY=player.y|0;
  const deltaX=Math.abs(1/cos),deltaY=Math.abs(1/sin);
  let stepX,stepY,sideDistX,sideDistY;
  if(cos<0){stepX=-1;sideDistX=(player.x-mapX)*deltaX;}
  else{stepX=1;sideDistX=(mapX+1-player.x)*deltaX;}
  if(sin<0){stepY=-1;sideDistY=(player.y-mapY)*deltaY;}
  else{stepY=1;sideDistY=(mapY+1-player.y)*deltaY;}
  let side=0,dist=0;
  for(let i=0;i<64;i++){
    if(sideDistX<sideDistY){sideDistX+=deltaX;mapX+=stepX;side=0;}
    else{sideDistY+=deltaY;mapY+=stepY;side=1;}
    if(isWall(mapX,mapY)){dist=side===0?(sideDistX-deltaX):(sideDistY-deltaY);break;}
  }
  return{dist,side,mapX,mapY};
}

function render(){
  ctx.fillStyle='#06060e';ctx.fillRect(0,0,CW,HALF_H);
  ctx.fillStyle=floorGrad;ctx.fillRect(0,HALF_H,CW,HALF_H);
  for(let i=0;i<RAYS;i++){
    const rayAngle=player.angle-FOV/2+(FOV*i/RAYS);
    const{dist,side,mapX,mapY}=cast(rayAngle);
    const fishEye=dist*Math.cos(rayAngle-player.angle);
    const wallH=Math.min(CH,(CH/fishEye)|0);
    const top=(HALF_H-wallH/2)|0;
    ctx.fillStyle=wallColor(dist,side,mapX,mapY);
    ctx.fillRect(i,top,1,wallH);
    if(wallH>60){
      const grd=ctx.createLinearGradient(i,top,i+1,top+wallH);
      grd.addColorStop(0,'rgba(255,255,255,0.18)');
      grd.addColorStop(0.05,'rgba(255,255,255,0)');
      grd.addColorStop(0.95,'rgba(255,255,255,0)');
      grd.addColorStop(1,'rgba(255,255,255,0.10)');
      ctx.fillStyle=grd;ctx.fillRect(i,top,1,wallH);
    }
  }
  drawMinimap();
}

// Slower turning
let turnDir=1,turnTimer=0;
function autoMove(){
  const nx=player.x+Math.cos(player.angle)*player.speed;
  const ny=player.y+Math.sin(player.angle)*player.speed;
  if(!isWall(nx,player.y)) player.x=nx; else turnDir=Math.random()<0.5?1:-1;
  if(!isWall(player.x,ny)) player.y=ny; else turnDir=Math.random()<0.5?1:-1;
  turnTimer++;
  if(turnTimer>120+Math.random()*80){turnTimer=0;turnDir=Math.random()<0.5?1:-1;}
  player.angle+=0.008*turnDir;  // slower turn rate
  const fw_x=player.x+Math.cos(player.angle)*0.3;
  const fw_y=player.y+Math.sin(player.angle)*0.3;
  if(isWall(fw_x,fw_y)) player.angle+=Math.PI*0.2*turnDir;
}

// ── Meaningful Audio: dungeon ambience ────────────────────────
let aCtx=null;
function initAudio(){
  if(aCtx)return;
  aCtx=new(window.AudioContext||window.webkitAudioContext)();
  const master=aCtx.createGain();
  master.gain.setValueAtTime(0,aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.5,aCtx.currentTime+3);
  master.connect(aCtx.destination);

  // Long reverb impulse
  const rb=aCtx.createBuffer(2,aCtx.sampleRate*3,aCtx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);}
  const rev=aCtx.createConvolver();rev.buffer=rb;
  const rg=aCtx.createGain();rg.gain.value=0.5;rev.connect(rg);rg.connect(master);

  // Deep dungeon drone (low rumble)
  [27.5,55,82.4].forEach((f,i)=>{
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sawtooth';o.frequency.value=f;
    const lp=aCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=180;lp.Q.value=2;
    g.gain.value=0.05-i*0.01;
    o.connect(lp);lp.connect(g);g.connect(rev);o.start();
  });

  // Eerie mid-frequency shimmer
  const shim=aCtx.createOscillator();const shimG=aCtx.createGain();
  shim.type='sine';shim.frequency.value=220;shimG.gain.value=0.03;
  const shimLfo=aCtx.createOscillator();const shimLg=aCtx.createGain();
  shimLfo.frequency.value=0.3;shimLg.gain.value=15;
  shimLfo.connect(shimLg);shimLg.connect(shim.frequency);
  shim.connect(shimG);shimG.connect(rev);shim.start();shimLfo.start();

  // Footstep rhythm — soft thud
  function step(){
    const now=aCtx.currentTime;
    const b=aCtx.createBuffer(1,aCtx.sampleRate*0.12,aCtx.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.5)*0.7;
    const s=aCtx.createBufferSource();s.buffer=b;
    const g=aCtx.createGain();g.gain.value=0.4;
    s.connect(g);g.connect(rev);s.start(now);
    setTimeout(step,600+Math.random()*300);
  }
  setTimeout(step,500);

  // Distant echo — eerie high ping
  function echo(){
    const now=aCtx.currentTime;
    const o=aCtx.createOscillator();const g=aCtx.createGain();
    o.type='sine';o.frequency.value=440+Math.random()*220;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.06,now+0.05);g.gain.exponentialRampToValueAtTime(0.0001,now+2.5);
    o.connect(g);g.connect(rev);o.start(now);o.stop(now+3);
    setTimeout(echo,4000+Math.random()*4000);
  }
  setTimeout(echo,1500);
}
document.addEventListener('click',initAudio,{once:true});
setTimeout(()=>{try{initAudio();}catch(e){}},500);

function animate(){autoMove();render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
