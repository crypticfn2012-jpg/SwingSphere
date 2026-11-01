import { LEVELS } from './level-data.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const hex=c=>'#'+(Number(c)||0x52e3ed).toString(16).padStart(6,'0');
const rand=(a,b)=>a+Math.random()*(b-a);

export class SwingGame {
  constructor(canvas,callbacks={}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.cb=callbacks;
    this.running=false;this.paused=false;this.mode='levels';this.levelIndex=0;
    this.keys={};this.targets=[];this.platforms=[];this.hazards=[];this.particles=[];this.stars=[];
    this.elapsed=0;this.distance=0;this.maxHeight=0;this.maxFPS=60;this.quality='high';
    this.sensitivity=1;this.cameraShake=false;this.cameraDistance=8;this.baseFov=75;
    this.pointer={x:0,y:0,down:false};this.rope=null;this.trailKind='default';this.cosmetic={color:0x52e3ed,shape:'sphere'};
    this.lastTime=0;this.lastHud=0;this.raf=0;this.accumulator=0;this.ground=false;
    this.onKey=e=>this.key(e,true);this.onKeyUp=e=>this.key(e,false);
    this.onPointerMove=e=>this.pointerMove(e);this.onPointerDown=e=>this.pointerDown(e);
    this.onPointerUp=e=>this.pointerUp(e);this.onContext=e=>e.preventDefault();
    this.onResize=()=>this.resize();
  }
  async init(){
    this.resize();window.addEventListener('resize',this.onResize);
    window.addEventListener('keydown',this.onKey);window.addEventListener('keyup',this.onKeyUp);
    this.canvas.addEventListener('pointermove',this.onPointerMove);this.canvas.addEventListener('pointerdown',this.onPointerDown);
    window.addEventListener('pointerup',this.onPointerUp);this.canvas.addEventListener('contextmenu',this.onContext);
    this.stars=Array.from({length:100},()=>({x:Math.random(),y:Math.random(),r:rand(.5,2),a:rand(.18,.7),p:rand(0,6)}));
    this.running=true;this.lastTime=performance.now();this.raf=requestAnimationFrame(t=>this.animate(t));return this;
  }
  resize(){
    const dpr=Math.min(window.devicePixelRatio||1,this.quality==='low'?1:this.quality==='medium'?1.35:1.8);
    this.width=Math.max(1,this.canvas.clientWidth||innerWidth);this.height=Math.max(1,this.canvas.clientHeight||innerHeight);
    this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  setFrameRate(fps){this.maxFPS=Number(fps)||0;}
  applyQuality(q){this.quality=q;this.resize();}
  setCosmetic(item){
    if(!item)return;
    if(item.type==='color'){this.cosmetic.color=item.color||0x52e3ed;this.cosmetic.rainbow=item.id==='color-rainbow';}
    if(item.type==='shape')this.cosmetic.shape=item.id.replace('shape-','');
    if(item.type==='trail')this.trailKind=item.id.replace('trail-','');
  }
  key(e,down){
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    this.keys[e.code]=down;
    if(down&&!e.repeat){
      if(e.code==='KeyR'&&this.canRestart){this.restart();this.cb.onRestart?.();}
      if(e.code==='Escape'&&this.canRestart)this.cb.onPause?.();
      if(e.code==='Space')this.jump();
    }
  }
  pointerWorld(e){
    const rect=this.canvas.getBoundingClientRect(),sx=e.clientX-rect.left,sy=e.clientY-rect.top;
    return {x:this.cameraX+sx/this.scale,y:this.cameraY+(this.height*.62-sy)/this.scale};
  }
  pointerMove(e){this.pointer.x=e.clientX;this.pointer.y=e.clientY;this.pointerWorldCache=this.pointerWorld(e);}
  pointerDown(e){
    if(e.button!==0&&e.pointerType!=='touch')return;
    this.pointer.down=true;this.grapplePointerId=e.pointerId;this.canvas.setPointerCapture?.(e.pointerId);this.pointerWorldCache=this.pointerWorld(e);
    if(!this.rope)this.attach();
  }
  pointerUp(e){if(e&&this.grapplePointerId!==undefined&&e.pointerId!==this.grapplePointerId)return;this.pointer.down=false;this.grapplePointerId=undefined;if(this.rope)this.release();}
  attach(){
    if(!this.running||this.paused||this.dead||this.completed)return;
    const p=this.pointerWorldCache;if(!p)return;
    let best=null,bd=1.9*(this.sensitivity||1);
    for(const t of this.targets){const d=Math.hypot(t.x-p.x,t.y-p.y);if(d<bd){bd=d;best=t;}}
    if(!best)return;
    const d=Math.hypot(best.x-this.player.x,best.y-this.player.y);
    const limit=best.type==='limited'?7.5:13.5;if(d>limit)return;
    this.rope={target:best,length:Math.max(2.2,d*1.02)};this.player.vx+=Math.sign(best.x-this.player.x||1)*2.8;this.player.vy+=1.2;
    if(best.type==='boost'){this.player.vx+=Math.sign(best.x-this.player.x||1)*7;this.player.vy+=7;}
    this.cb.onSwing?.();
    for(let i=0;i<9;i++)this.particle(best.x,best.y,rand(-2,2),rand(-1,3),'#6cf4ff',.45);
  }
  release(){if(this.rope){this.rope=null;this.cb.onRelease?.();}}
  jump(){
    if(!this.player||!this.ground||this.paused||this.dead)return;
    this.player.vy=10.8;this.ground=false;this.cb.onJump?.();
  }
  mapPlatform(p,i,total){
    return {x:-p[2]*.9,y:p[1]+p[0]*.18,w:Math.max(5,p[5]),kind:i===total-1?'finish':i===0?'checkpoint':'normal'};
  }
  buildLevel(index){
    this.mode='levels';this.levelIndex=clamp(index,0,9);const L=LEVELS[this.levelIndex];
    this.platforms=L.platforms.map((p,i)=>this.mapPlatform(p,i,L.platforms.length));
    this.targets=L.targets.map((p,i)=>({x:-p[2]*.9,y:p[1]+p[0]*.18,type:this.levelIndex===4&&i===1?'boost':this.levelIndex===6&&i===1?'limited':'standard',moving:this.levelIndex===2&&i===1,phase:rand(0,6.28),bx:-p[2]*.9,by:p[1]+p[0]*.18}));
    this.hazards=L.obstacles.map(h=>({x:-h[2]*.9,y:h[1]+h[0]*.18,r:Math.max(.75,h[3]*.55),phase:rand(0,6.28),bx:-h[2]*.9}));
    this.finishX=this.platforms[this.platforms.length-1].x;this.resetPlayer();this.cb.onLevel?.(L,this.levelIndex);
  }
  buildEndless(){
    this.mode='endless';this.platforms=[{x:0,y:0,w:13,kind:'checkpoint'}];this.targets=[];this.hazards=[];this.generated=0;
    for(let i=0;i<8;i++)this.generateEndless();this.resetPlayer();this.cb.onMode?.('endless');
  }
  generateEndless(){
    const i=this.generated++,x=12+i*11.5+rand(-1.2,1.2),y=rand(-.3,2.8)+Math.min(i*.18,9);
    this.platforms.push({x,y,w:rand(5.5,8),kind:'normal'});
    this.targets.push({x:x-rand(1,3),y:y+rand(4,6),type:Math.random()<.13?'boost':'standard',moving:Math.random()<.3,phase:rand(0,6.28),bx:x-rand(1,3),by:y+5});
    if(i>2&&Math.random()<.35)this.hazards.push({x:x-5,y:y+2,r:1.1,phase:rand(0,6.28),bx:x-5});
  }
  buildLava(){
    this.mode='lava';this.platforms=[{x:0,y:0,w:13,kind:'checkpoint'}];this.targets=[];this.hazards=[];this.generated=0;this.lavaY=-8;this.lavaSpeed=1.55;
    for(let i=0;i<10;i++)this.generateLava();this.resetPlayer();this.cb.onMode?.('lava');
  }
  generateLava(){
    const i=this.generated++,x=9+i*9.2+rand(-1,1),y=2+i*2.8;
    this.platforms.push({x,y,w:rand(5.5,7.5),kind:'normal'});
    this.targets.push({x:x-2,y:y+4,type:i%4===0?'boost':'standard',moving:i%3===0,phase:rand(0,6.28),bx:x-2,by:y+4});
    if(i%2===1)this.hazards.push({x:x-4,y:y+1.5,r:1,phase:rand(0,6.28),bx:x-4});
  }
  resetPlayer(){
    this.player={x:0,y:1.05,vx:0,vy:0,r:.58,rot:0};
    this.elapsed=0;this.distance=0;this.maxHeight=1.05;this.dead=false;this.completed=false;this.ground=false;
    this.cameraX=-this.width/this.scale*.38;this.cameraY=4;this.rope=null;this.particles=[];this.trailClock=0;this.lastHud=0;this.lavaY=this.mode==='lava'?-8:-100;
    this.pointer.down=false;this.cb.onRunStart?.();
  }
  restart(){if(this.mode==='levels')this.buildLevel(this.levelIndex);else if(this.mode==='endless')this.buildEndless();else this.buildLava();}
  particle(x,y,vx,vy,color,life=.5){this.particles.push({x,y,vx,vy,color,life,max:life});}
  update(dt){
    if(!this.player||this.dead||this.completed)return;
    this.elapsed+=dt;const p=this.player,prevY=p.y,wasGround=this.ground;
    for(const t of this.targets){if(t.moving){t.x=t.bx+Math.sin(this.elapsed*1.5+t.phase)*1.35;t.y=t.by+Math.cos(this.elapsed*1.2+t.phase)*.55;}}
    for(const h of this.hazards){h.x=h.bx+Math.sin(this.elapsed*.9+h.phase)*.85;}
    let dir=0;if(this.keys.KeyD||this.keys.ArrowRight)dir++;if(this.keys.KeyA||this.keys.ArrowLeft)dir--;
    p.vx+=dir*(this.ground?24:15)*dt;
    if(this.keys.KeyW||this.keys.ArrowUp)p.vy+=4*dt;
    if(this.keys.KeyS||this.keys.ArrowDown)p.vy-=4*dt;
    p.vy-=23*dt;
    p.vx*=Math.pow(this.ground ? .94 : .997,dt*60);p.vy*=Math.pow(.999,dt*60);
    p.vx=clamp(p.vx,-25,25);p.vy=clamp(p.vy,-28,19);
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vx*dt*.9;
    this.ground=false;
    for(const q of this.platforms){
      const left=q.x-q.w/2,right=q.x+q.w/2;
      if(p.x+p.r>left&&p.x-p.r<right&&prevY>=q.y+p.r-.12&&p.y<=q.y+p.r&&p.vy<=0){
        p.y=q.y+p.r;p.vy=0;if(!wasGround){this.cb.onLand?.();for(let i=0;i<7;i++)this.particle(p.x+rand(-.4,.4),q.y+.1,rand(-2,2),rand(.5,2),'#8deaff',.28);}this.ground=true;
      }
    }
    if(this.rope){
      const t=this.rope.target,dx=p.x-t.x,dy=p.y-t.y,d=Math.hypot(dx,dy)||.001;
      if(d>this.rope.length){const nx=dx/d,ny=dy/d;p.x=t.x+nx*this.rope.length;p.y=t.y+ny*this.rope.length;const radial=p.vx*nx+p.vy*ny;if(radial>0){p.vx-=nx*radial;p.vy-=ny*radial;}}
    }
    if(p.y< -24||p.y<this.cameraY-15){this.fail();return;}
    for(const h of this.hazards){const d=Math.hypot(p.x-h.x,p.y-h.y);if(Math.abs(d-h.r)<p.r+.16){this.fail();return;}}
    if(this.mode==='lava'){
      this.lavaY+=this.lavaSpeed*dt;this.lavaSpeed+=dt*.025;
      if(p.y<this.lavaY+1){this.fail();return;}
      while(this.generated<80&&this.platforms[this.platforms.length-1].x<this.cameraX+35)this.generateLava();
    }
    if(this.mode==='endless'){
      while(this.generated<200&&this.platforms[this.platforms.length-1].x<this.cameraX+38)this.generateEndless();
      const cut=this.cameraX-30;this.platforms=this.platforms.filter(q=>q.x+q.w>cut);this.targets=this.targets.filter(t=>t.x>cut);if(this.rope&&!this.targets.includes(this.rope.target))this.release();this.hazards=this.hazards.filter(h=>h.x>cut);
    }
    if(this.mode==='levels'){
      const end=this.platforms[this.platforms.length-1];
      if(p.x>end.x-end.w*.35&&p.x<end.x+end.w*.65&&p.y>end.y+.25){this.complete();return;}
    }
    this.distance=Math.max(this.distance,p.x);this.maxHeight=Math.max(this.maxHeight,p.y);
    this.cameraX=lerp(this.cameraX,p.x-(this.width/this.scale)*.38,1-Math.pow(.0005,dt));
    const targetY=this.mode==='lava'?p.y+2.2:Math.max(3,p.y+1.3);
    this.cameraY=lerp(this.cameraY,targetY,1-Math.pow(.002,dt));
    this.trailClock+=dt;
    if(this.trailKind!=='default'&&this.trailClock>.035){this.trailClock=0;const colors={rainbow:['#ff6bb5','#ffd166','#69e7ff','#a78bfa'],fire:['#ff663d','#ffb04a'],ice:['#8beaff','#e9fbff'],lightning:['#a5b4fc','#fef08a'],neon:['#a78bfa','#57e6ef'],stars:['#ffd76b','#fff'],bubbles:['#8beaff','#d6f7ff'],pixel:['#6cf4ff','#b2a4ff'],plasma:['#c084fc','#ff72bd']};const a=colors[this.trailKind]||['#65eaff'];this.particle(p.x-.3,p.y-.1,rand(-1,1),rand(-1,1),a[Math.floor(Math.random()*a.length)],.42);}
    for(const q of this.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy-=3*dt;q.life-=dt;}this.particles=this.particles.filter(q=>q.life>0);
    if(this.mode==='lava'&&this.lavaY>this.maxHeight+15)this.fail();
    if(this.elapsed-this.lastHud>.08){this.lastHud=this.elapsed;this.cb.onHUD?.({time:this.elapsed,speed:Math.hypot(p.vx,p.vy),distance:this.distance,height:this.maxHeight,mode:this.mode,rope:!!this.rope});}
  }
  get scale(){const zoom=1+(Number(this.cameraDistance||8)-8)*.018+(Number(this.baseFov||75)-75)*.002;return Math.min(58,Math.max(34,this.height*.075))*zoom;}
  sx(x){return (x-this.cameraX)*this.scale;}
  sy(y){return this.height*.62-(y-this.cameraY)*this.scale;}
  roundRect(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
  draw(){
    const c=this.ctx,w=this.width,h=this.height,s=this.scale;
    c.save();
    if(this.cameraShake)c.translate(rand(-1.2,1.2),rand(-.8,.8));

    const sky=c.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#111b45');sky.addColorStop(.42,'#29255a');sky.addColorStop(.72,'#74416a');sky.addColorStop(1,'#1a2140');
    c.fillStyle=sky;c.fillRect(0,0,w,h);

    const horizon=c.createRadialGradient(w*.65,h*.65,10,w*.65,h*.65,w*.65);
    horizon.addColorStop(0,'rgba(255,151,106,.34)');horizon.addColorStop(.55,'rgba(183,86,124,.11)');horizon.addColorStop(1,'rgba(183,86,124,0)');
    c.fillStyle=horizon;c.fillRect(0,0,w,h);

    for(const st of this.stars){
      const x=((st.x*w-this.cameraX*s*.025)%w+w)%w,y=st.y*h;
      c.globalAlpha=st.a*(.72+.28*Math.sin(this.elapsed*.7+st.p));c.fillStyle='#fff0d5';
      c.beginPath();c.arc(x,y,Math.max(.6,st.r*.7),0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;

    // Distant city layers use deterministic building silhouettes for a clean parallax skyline.
    for(let layer=0;layer<4;layer++){
      const parallax=this.cameraX*s*(.045+layer*.055);
      const step=layer===0?118:layer===1?92:layer===2?76:62;
      const offset=((parallax%step)+step)%step;
      const base=h*(.48+layer*.115);
      const start=Math.floor(parallax/step);
      for(let j=-2;j<Math.ceil(w/step)+2;j++){
        const id=start+j;
        const seed=Math.abs(Math.sin(id*127.1+layer*41.7));
        const bw=step*(.64+seed*.25),bh=h*(.13+Math.abs(Math.sin(id*17.3+layer))* (.17+layer*.035));
        const x=j*step-offset+(step-bw)/2,top=base-bh;
        const shades=['#25294f','#202447','#1a203e','#151a34'];
        c.fillStyle=shades[layer];c.fillRect(x,top,bw,bh+h);
        c.fillStyle=layer<2?'rgba(15,20,49,.8)':'rgba(11,17,38,.92)';
        c.fillRect(x-3,top+4,bw+6,5);
        if(layer>0){
          const cols=Math.max(2,Math.floor(bw/17)),rows=Math.max(2,Math.floor(bh/24));
          for(let ry=0;ry<rows;ry++)for(let rx=0;rx<cols;rx++){
            if(Math.sin(id*9+ry*13+rx*7)>.12){
              c.fillStyle=(rx+ry+id)%5===0?'rgba(255,178,119,.72)':'rgba(255,210,157,.3)';
              c.fillRect(x+7+rx*15,top+15+ry*23,5,8);
            }
          }
        }
        if(layer===3&&seed>.58){
          c.strokeStyle='rgba(11,17,38,.95)';c.lineWidth=2;c.beginPath();c.moveTo(x+bw*.5,top);c.lineTo(x+bw*.5,top-16-seed*20);c.stroke();
        }
      }
    }

    // A soft moon keeps the night-time palette warm without obscuring the playfield.
    c.save();c.shadowBlur=24;c.shadowColor='rgba(255,204,145,.35)';c.fillStyle='#f4c78d';
    c.beginPath();c.arc(w*.76,h*.18,Math.min(30,h*.035),0,Math.PI*2);c.fill();c.restore();

    const visible=x=>this.sx(x)>-150&&this.sx(x)<w+150;

    if(this.mode==='lava'&&this.lavaY>-50){
      const y=this.sy(this.lavaY),lg=c.createLinearGradient(0,y-24,0,y+90);
      lg.addColorStop(0,'#ffe18d');lg.addColorStop(.16,'#ff9862');lg.addColorStop(.55,'#ec5e64');lg.addColorStop(1,'#712a59');
      c.fillStyle=lg;c.fillRect(0,y,w,h-y);c.save();c.shadowBlur=22;c.shadowColor='#ff9862';c.strokeStyle='#ffe2a0';c.lineWidth=3;
      c.beginPath();c.moveTo(0,y);for(let x=0;x<=w;x+=16)c.lineTo(x,y+Math.sin(x*.018+this.elapsed*2.5)*5+Math.sin(x*.043+this.elapsed)*2);c.stroke();c.restore();
    }

    // Rooftops are deliberately chunky and readable, with lit windows and small rooftop details.
    for(const q of this.platforms){
      if(!visible(q.x))continue;
      const x=this.sx(q.x-q.w/2),y=this.sy(q.y),pw=q.w*s,facade=Math.max(42,h-y);
      const wall=c.createLinearGradient(x,y,x+pw,y+facade);
      wall.addColorStop(0,'#283453');wall.addColorStop(1,'#111a33');
      c.fillStyle=wall;c.fillRect(x,y+8,pw,facade);
      c.fillStyle='#10172f';c.fillRect(x+4,y+facade-4,Math.max(0,pw-8),5);
      const count=Math.max(1,Math.min(8,Math.floor(pw/27)));
      for(let i=0;i<count;i++){
        const wx=x+12+i*(pw-24)/count;
        c.fillStyle=(i+Math.round(q.x))%3===0?'rgba(255,181,115,.8)':'rgba(255,205,151,.38)';
        c.fillRect(wx,y+27,Math.min(10,pw/count*.42),Math.min(23,facade-32));
      }
      c.fillStyle='#55617d';c.fillRect(x-3,y-2,pw+6,8);
      c.fillStyle='#ffb987';c.fillRect(x,y-2,pw,2);
      c.fillStyle='#10172f';c.fillRect(x+pw*.18,y-18,Math.max(18,pw*.18),17);
      c.fillStyle='#66708b';c.fillRect(x+pw*.18+3,y-18,Math.max(12,pw*.18-6),3);
      if(q.kind==='finish'){
        c.fillStyle='#b7edc9';c.fillRect(x+pw*.72,y-25,2,23);c.fillStyle='#b7edc9';
        c.beginPath();c.moveTo(x+pw*.72,y-24);c.lineTo(x+pw*.72+17,y-19);c.lineTo(x+pw*.72,y-14);c.fill();
      }
    }

    for(const hzd of this.hazards){
      if(!visible(hzd.x))continue;
      const x=this.sx(hzd.x),y=this.sy(hzd.y),r=hzd.r*s;
      c.save();c.translate(x,y);c.rotate(this.elapsed*1.5+hzd.phase);c.shadowBlur=12;c.shadowColor='#fa786c';
      c.fillStyle='#e56d68';c.strokeStyle='#ffd0a7';c.lineWidth=2;
      c.beginPath();
      for(let i=0;i<16;i++){const a=i*Math.PI/8,rr=i%2?r:r*.72;i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}
      c.closePath();c.fill();c.stroke();c.fillStyle='#332c52';c.beginPath();c.arc(0,0,r*.36,0,Math.PI*2);c.fill();
      c.fillStyle='#ffe1b5';c.beginPath();c.arc(0,0,r*.12,0,Math.PI*2);c.fill();c.restore();
    }

    for(const t of this.targets){
      if(!visible(t.x))continue;
      const x=this.sx(t.x),y=this.sy(t.y),pulse=1+Math.sin(this.elapsed*3.2+t.phase)*.08;
      const col=t.type==='boost'?'#ffd08d':t.type==='limited'?'#f39b9a':'#b7edc9';
      const hovered=this.pointerWorldCache&&Math.hypot(t.x-this.pointerWorldCache.x,t.y-this.pointerWorldCache.y)<1.9;
      c.save();c.translate(x,y);c.scale(pulse,pulse);
      c.strokeStyle='#29304c';c.lineWidth=7;c.beginPath();c.arc(0,0,16,0,Math.PI*2);c.stroke();
      c.shadowBlur=hovered?24:15;c.shadowColor=col;c.strokeStyle=hovered?'#fff0d8':col;c.lineWidth=3;
      c.beginPath();c.arc(0,0,hovered?17:15,0,Math.PI*2);c.stroke();
      c.fillStyle=col;c.globalAlpha=.22;c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();c.globalAlpha=1;
      c.fillStyle='#fff0d8';c.beginPath();c.arc(0,0,3.2,0,Math.PI*2);c.fill();
      c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(-6,-22);c.lineTo(6,-22);c.stroke();c.restore();
    }

    if(this.rope){
      const x1=this.sx(this.player.x),y1=this.sy(this.player.y),x2=this.sx(this.rope.target.x),y2=this.sy(this.rope.target.y);
      c.save();c.lineCap='round';c.shadowBlur=10;c.shadowColor='#d5f6d7';c.strokeStyle='rgba(255,242,210,.95)';c.lineWidth=2.4;
      c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore();
    }

    for(const q of this.particles){
      const x=this.sx(q.x),y=this.sy(q.y);c.globalAlpha=clamp(q.life/q.max,0,1);c.fillStyle=q.color;
      c.beginPath();c.arc(x,y,Math.max(1,3.5*q.life/q.max),0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;
    this.drawPlayer(c);

    if(this.mode==='levels'){
      const end=this.platforms[this.platforms.length-1],x=this.sx(end.x),y=this.sy(end.y);
      if(x>w*.6){c.globalAlpha=.75;c.fillStyle='#f7dfb7';c.font='800 10px sans-serif';c.textAlign='center';c.fillText('FINISH',x,y-32);c.globalAlpha=1;}
    }
    c.restore();
  }
  drawPlayer(c){
    const p=this.player,x=this.sx(p.x),y=this.sy(p.y),r=p.r*this.scale;
    const skin=this.cosmetic.rainbow;
    let fill;
    if(skin){
      fill=c.createLinearGradient(-r,-r,r,r);fill.addColorStop(0,'#ff977e');fill.addColorStop(.28,'#ffd28e');fill.addColorStop(.53,'#b7edc9');fill.addColorStop(.78,'#8bc5e8');fill.addColorStop(1,'#c9a4dc');
    }else fill=hex(this.cosmetic.color);
    const wobble=Math.sin(this.elapsed*9)*.06,lean=clamp(p.vx/28,-.28,.28);
    c.save();c.translate(x,y);c.rotate(clamp(p.rot*.12+lean,-.55,.55));
    // The little runner has a soft bean-shaped body rather than a featureless ball.
    const limb=(x1,y1,x2,y2,width,color)=>{
      c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x1,y1);c.quadraticCurveTo((x1+x2)*.5,(y1+y2)*.5-2,x2,y2);c.stroke();
    };
    const target=this.rope?.target;
    const armAngle=target?Math.atan2(-(target.y-p.y),target.x-p.x):(-.8+Math.sin(this.elapsed*7)*.13);
    const ax=Math.cos(armAngle)*r*.72,ay=-Math.sin(armAngle)*r*.72;
    const legSwing=Math.sin(this.elapsed*7+p.rot)*r*.16;
    limb(-r*.2,r*.48,-r*.38+legSwing,r*.86,r*.18,'#24304b');
    limb(r*.2,r*.48,r*.34-legSwing,r*.86,r*.18,'#24304b');
    c.fillStyle='#f3a77c';c.beginPath();c.ellipse(-r*.38+legSwing,r*.88,r*.2,r*.09,-.1,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(r*.34-legSwing,r*.88,r*.2,r*.09,-.1,0,Math.PI*2);c.fill();
    limb(-r*.34,-r*.05,-r*.63,-r*.22,r*.17,'#24304b');
    limb(r*.34,-r*.05,ax,ay,r*.18,'#24304b');
    c.fillStyle='#f3a77c';c.beginPath();c.arc(ax,ay,r*.105,0,Math.PI*2);c.fill();
    c.fillStyle=fill;c.strokeStyle='#293451';c.lineWidth=Math.max(2,r*.12);c.shadowColor=skin?'#b7edc9':hex(this.cosmetic.color);c.shadowBlur=10;
    c.beginPath();c.ellipse(0,r*.12,r*.43,r*.55+wobble,0,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;
    // Scarf knot and loose tail flutter in the opposite direction to travel.
    c.fillStyle='#ed806c';c.beginPath();c.moveTo(-r*.33,-r*.12);c.quadraticCurveTo(-r*.74,-r*.28,-r*(1.05+Math.min(.25,Math.abs(p.vx)*.01)),-r*.05);c.quadraticCurveTo(-r*.79,r*.14,-r*.38,r*.16);c.closePath();c.fill();
    c.fillStyle='#ffad83';c.beginPath();c.ellipse(0,-r*.36,r*.34,r*.33,0,0,Math.PI*2);c.fill();c.strokeStyle='#293451';c.lineWidth=Math.max(1.7,r*.09);c.stroke();
    c.fillStyle='#25304b';c.beginPath();c.ellipse(-r*.12,-r*.38,r*.045,r*.09,0,0,Math.PI*2);c.ellipse(r*.12,-r*.38,r*.045,r*.09,0,0,Math.PI*2);c.fill();
    c.fillStyle='#fff2df';c.beginPath();c.arc(-r*.13,-r*.41,r*.018,0,Math.PI*2);c.arc(r*.11,-r*.41,r*.018,0,Math.PI*2);c.fill();
    c.restore();
  }
  animate(now){
    if(!this.running)return;
    const raw=Math.min(.05,Math.max(0,(now-this.lastTime)/1000||0));this.lastTime=now;this.accumulator=(this.accumulator||0)+raw;
    const fps=this.maxFPS;if(!this.paused&&(!fps||now-this.lastRender>=1000/fps)){const dt=Math.min(.05,this.accumulator);this.accumulator=0;this.update(dt);this.draw();this.lastRender=now;}
    else if(this.paused)this.draw();
    this.raf=requestAnimationFrame(t=>this.animate(t));
  }
  complete(){if(this.completed||this.dead)return;this.completed=true;this.cb.onComplete?.({level:this.levelIndex,time:this.elapsed,distance:this.distance});}
  fail(){if(this.dead||this.completed)return;this.dead=true;this.cb.onFail?.({mode:this.mode,distance:this.distance,height:this.maxHeight});}
  pause(){this.paused=true;}
  resume(){this.paused=false;this.lastTime=performance.now();}
  destroy(){this.running=false;cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.onResize);window.removeEventListener('keydown',this.onKey);window.removeEventListener('keyup',this.onKeyUp);this.canvas.removeEventListener('pointermove',this.onPointerMove);this.canvas.removeEventListener('pointerdown',this.onPointerDown);window.removeEventListener('pointerup',this.onPointerUp);this.canvas.removeEventListener('contextmenu',this.onContext);}
}
