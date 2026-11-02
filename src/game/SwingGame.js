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
    this.sensitivity=1;this.grappleRange=18;this.cameraShake=false;this.cameraDistance=8;this.baseFov=75;
    this.pointer={x:0,y:0,down:false};this.rope=null;this.trailKind='default';this.cosmetic={color:0x55d9e7,shape:'sphere'};
    this.lastTime=0;this.lastRender=0;this.lastHud=0;this.raf=0;this.pauseNeedsDraw=false;this.accumulator=0;this.ground=false;
    this.onKey=e=>this.key(e,true);this.onKeyUp=e=>this.key(e,false);
    this.onPointerMove=e=>this.pointerMove(e);this.onPointerDown=e=>this.pointerDown(e);
    this.onPointerUp=e=>this.pointerUp(e);this.onContext=e=>e.preventDefault();
    this.onResize=()=>{this.resize();if(this.paused)this.pauseNeedsDraw=true;};
  }
  async init(){
    this.resize();window.addEventListener('resize',this.onResize);
    window.addEventListener('keydown',this.onKey);window.addEventListener('keyup',this.onKeyUp);
    this.canvas.addEventListener('pointermove',this.onPointerMove);this.canvas.addEventListener('pointerdown',this.onPointerDown);
    window.addEventListener('pointerup',this.onPointerUp);this.canvas.addEventListener('contextmenu',this.onContext);
    this.stars=Array.from({length:100},()=>({x:Math.random(),y:Math.random(),r:rand(.5,2),a:rand(.18,.7),p:rand(0,6)}));
    this.running=true;this.lastTime=performance.now();this.lastRender=0;this.raf=requestAnimationFrame(t=>this.animate(t));return this;
  }
  resize(){
    const dpr=Math.min(window.devicePixelRatio||1,this.quality==='low'?1:this.quality==='medium'?1.35:1.8);
    this.width=Math.max(1,this.canvas.clientWidth||innerWidth);this.height=Math.max(1,this.canvas.clientHeight||innerHeight);
    this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);if(this.paused)this.pauseNeedsDraw=true;
  }
  setFrameRate(fps){this.maxFPS=Number(fps)||0;}
  applyQuality(q){this.quality=q;this.resize();}
  setCosmetic(item){
    if(!item)return;
    if(item.type==='color'){this.cosmetic.color=item.color||0x55d9e7;this.cosmetic.rainbow=item.id==='color-rainbow';if(this.paused)this.pauseNeedsDraw=true;}
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
  findAnchor(maxDistance=this.grappleRange,exclude=null){
    if(!this.player)return null;
    const p=this.player;
    let best=null,bestScore=Infinity;
    for(const t of this.targets){
      if(t===exclude)continue;
      const dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy);
      const limit=t.type==='limited'?Math.min(7.5,maxDistance):maxDistance;
      if(d>limit||dx < -2.5)continue;
      // Prefer the closest reachable ring, with a small preference for the route ahead.
      const score=d+(dx<0?4:0)-Math.min(2.2,Math.max(0,dx)*.055);
      if(score<bestScore){best=t;bestScore=score;}
    }
    return best;
  }
  attach(){
    if(!this.running||this.paused||this.dead||this.completed||!this.player)return false;
    const best=this.findAnchor();
    if(!best)return false;
    const d=Math.hypot(best.x-this.player.x,best.y-this.player.y);
    this.rope={target:best,length:Math.max(2.8,d*1.035)};
    this.player.vx+=Math.sign(best.x-this.player.x||1)*3.4;
    if(best.type==='boost'){this.player.vx+=Math.sign(best.x-this.player.x||1)*5;this.player.vy+=4.5;}
    this.cb.onSwing?.();
    for(let i=0;i<8;i++)this.particle(best.x,best.y,rand(-2,2),rand(-1,3),'#6cf4ff',.4);
    return true;
  }
  autoTransfer(){
    if(!this.pointer.down||!this.rope||!this.player)return;
    const next=this.findAnchor(7.5,this.rope.target);
    if(!next)return;
    const d=Math.hypot(next.x-this.player.x,next.y-this.player.y);
    this.rope={target:next,length:Math.max(2.8,d*1.08)};
    this.cb.onSwing?.();
    for(let i=0;i<5;i++)this.particle(next.x,next.y,rand(-1.5,1.5),rand(-1,2),'#b7edc9',.3);
  }
  release(){if(this.rope){this.rope=null;this.cb.onRelease?.();}}
  jump(){
    if(!this.player||!this.ground||this.paused||this.dead)return;
    this.player.vy=9.2;this.ground=false;this.cb.onJump?.();
  }
  mapPlatform(p,i,total){
    return {x:-p[2]*.9,y:p[1]+p[0]*.18,w:Math.max(5,p[5]),kind:i===total-1?'finish':i===0?'checkpoint':'normal'};
  }
  buildLevel(index){
    this.mode='levels';this.levelIndex=clamp(index,0,LEVELS.length-1);const L=LEVELS[this.levelIndex];
    const difficulty=this.levelIndex/(LEVELS.length-1);
    const routeStretch=1;
    this.platforms=L.platforms.map((p,i)=>{
      const q=this.mapPlatform(p,i,L.platforms.length);
      q.x*=routeStretch;
      q.w=Math.max(i===0||i===L.platforms.length-1?9:6,p[5]*.92);
      return q;
    });
    this.targets=L.targets.map((p,i)=>{
      const x=-p[2]*.9*routeStretch,y=p[1]+p[0]*.18;
      return {x,y,type:this.levelIndex===4&&i===1?'boost':this.levelIndex===6&&i===1?'limited':'standard',moving:this.levelIndex===2&&i===1,phase:rand(0,6.28),bx:x,by:y};
    });
    this.hazards=L.obstacles.map(h=>({x:-h[2]*.9*routeStretch,y:h[1]+h[0]*.18,r:Math.max(.7,h[3]*.52),phase:rand(0,6.28),bx:-h[2]*.9*routeStretch}));
    this.finishX=this.platforms[this.platforms.length-1].x;this.resetPlayer();this.cb.onLevel?.(L,this.levelIndex);
  }
  buildEndless(){
    this.mode='endless';this.platforms=[{x:0,y:0,w:13,kind:'checkpoint'}];this.targets=[];this.hazards=[];this.generated=0;
    for(let i=0;i<8;i++)this.generateEndless();this.resetPlayer();this.cb.onMode?.('endless');
  }
  generateEndless(){
    const i=this.generated++,difficulty=Math.min(1,i/45),x=13+i*14+rand(-.8,.8),y=rand(-.3,2.8)+Math.min(i*.24,12);
    this.platforms.push({x,y,w:rand(4.2,5.8)-difficulty*.7,kind:'normal'});
    const anchorX=x-rand(6,7.5),anchorY=y+rand(5.5,7.5)+difficulty;
    this.targets.push({x:anchorX,y:anchorY,type:Math.random()<.13?'boost':'standard',moving:Math.random()<.3,phase:rand(0,6.28),bx:anchorX,by:anchorY});
    if(i>2&&Math.random()<.35)this.hazards.push({x:x-5,y:y+2,r:1.1,phase:rand(0,6.28),bx:x-5});
  }
  buildLava(){
    this.mode='lava';this.platforms=[{x:0,y:0,w:10,kind:'checkpoint'}];this.targets=[];this.hazards=[];this.generated=0;this.lavaY=-8;this.lavaSpeed=1.8;
    for(let i=0;i<10;i++)this.generateLava();this.resetPlayer();this.cb.onMode?.('lava');
  }
  generateLava(){
    const i=this.generated++,difficulty=Math.min(1,i/35),x=12+i*12.5+rand(-.7,.7),y=2+i*3.1;
    this.platforms.push({x,y,w:rand(4.5,6)-difficulty*.6,kind:'normal'});
    const anchorX=x-6,anchorY=y+5.5+difficulty;
    this.targets.push({x:anchorX,y:anchorY,type:i%4===0?'boost':'standard',moving:i%3===0,phase:rand(0,6.28),bx:anchorX,by:anchorY});
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
    p.vx+=dir*(this.ground?9:10)*dt;
    if(this.rope&&dir){
      const dx=p.x-this.rope.target.x,dy=p.y-this.rope.target.y,d=Math.hypot(dx,dy)||1;
      const tangentX=-dy/d,tangentY=dx/d;
      const direction=Math.sign(tangentX||1);
      p.vx+=tangentX*dir*direction*29*dt;
      p.vy+=tangentY*dir*direction*29*dt;
    }
    if((this.keys.KeyW||this.keys.ArrowUp)&&!this.rope&&this.ground)p.vy+=3*dt;
    if(this.keys.KeyS||this.keys.ArrowDown)p.vy-=2*dt;
    p.vy-=17*dt;
    p.vx*=Math.pow(this.ground ? .92 : .9994,dt*60);p.vy*=Math.pow(.999,dt*60);
    p.vx=clamp(p.vx,-34,34);p.vy=clamp(p.vy,-30,25);
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
    this.autoTransfer();
    if(this.pointer.down&&!this.rope)this.attach();
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
    if(this.elapsed-this.lastHud>.08){this.lastHud=this.elapsed;this.cb.onHUD?.({time:this.elapsed,speed:Math.hypot(p.vx,p.vy),distance:this.distance,height:this.maxHeight,mode:this.mode,rope:!!this.rope,grappleHeld:this.pointer.down});}
  }
  get scale(){const zoom=1+(Number(this.cameraDistance||8)-8)*.018+(Number(this.baseFov||75)-75)*.002;return Math.min(58,Math.max(34,this.height*.075))*zoom;}
  sx(x){return (x-this.cameraX)*this.scale;}
  sy(y){return this.height*.62-(y-this.cameraY)*this.scale;}
  roundRect(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
  draw(){
    const c=this.ctx,w=this.width,h=this.height,s=this.scale;
    c.save();
    // Layered dusk sky with a restrained warm horizon.
    const sky=c.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#17283b');sky.addColorStop(.52,'#344b5b');sky.addColorStop(1,'#d08b72');
    c.fillStyle=sky;c.fillRect(0,0,w,h);
    const glow=c.createRadialGradient(w*.72,h*.43,2,w*.72,h*.43,h*.52);
    glow.addColorStop(0,'rgba(244,190,139,.30)');glow.addColorStop(1,'rgba(244,190,139,0)');
    c.fillStyle=glow;c.fillRect(0,0,w,h);
    // Fine stars and distant skyline.
    for(const star of this.stars){
      const twinkle=.55+.45*Math.sin(this.elapsed*1.3+star.p);
      c.globalAlpha=star.a*twinkle;c.fillStyle='#fff3dc';
      c.beginPath();c.arc(star.x*w,star.y*h*.58,star.r,0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;
    for(let layer=0;layer<3;layer++){
      const step=layer===0?112:layer===1?78:56;
      const factor=layer===0?.025:layer===1?.055:.09;
      const parallax=this.cameraX*s*factor,offset=((parallax%step)+step)%step;
      const base=h*(layer===0?.72:layer===1?.81:.91);
      for(let j=-2;j<Math.ceil(w/step)+2;j++){
        const id=Math.floor(parallax/step)+j,seed=Math.abs(Math.sin(id*71.3+layer*19.7));
        const bw=step*(.62+seed*.28),bh=h*(.13+seed*.19);
        const x=j*step-offset+(step-bw)/2,y=base-bh;
        c.fillStyle=layer===0?'#344653':layer===1?'#263b49':'#1b2d3a';
        c.fillRect(x,y,bw,h-y);
        if(layer>0){
          c.fillStyle=layer===1?'rgba(242,190,139,.48)':'rgba(242,190,139,.7)';
          for(let k=0;k<Math.floor(bw/13);k++)for(let row=0;row<Math.floor((h-y)/22);row++){
            if(Math.sin(id*11+k*5+row*3)>.22)c.fillRect(x+7+k*13,y+12+row*22,3,5);
          }
        }
      }
    }
    const visible=x=>this.sx(x)>-120&&this.sx(x)<w+120;
    // Atmospheric ground haze.
    const haze=c.createLinearGradient(0,h*.66,0,h);
    haze.addColorStop(0,'rgba(15,29,40,0)');haze.addColorStop(1,'rgba(12,25,35,.42)');
    c.fillStyle=haze;c.fillRect(0,h*.6,w,h*.4);
    if(this.mode==='lava'&&this.lavaY>-50){
      const y=this.sy(this.lavaY);
      const lava=c.createLinearGradient(0,y-12,0,h);lava.addColorStop(0,'#ffbd72');lava.addColorStop(.12,'#f07855');lava.addColorStop(1,'#a93e45');
      c.fillStyle=lava;c.fillRect(0,y,w,h-y);
      c.fillStyle='#ffe0a2';c.shadowColor='#ff9b61';c.shadowBlur=18;c.fillRect(0,y-3,w,4);c.shadowBlur=0;
    }
    for(const q of this.platforms){
      if(!visible(q.x))continue;
      const x=this.sx(q.x-q.w/2),y=this.sy(q.y),pw=q.w*s;
      c.fillStyle='rgba(8,20,30,.34)';c.fillRect(x,y+7,pw,Math.max(0,h-y-7));
      c.fillStyle=q.kind==='finish'?'#d2c89c':'#263d4b';c.fillRect(x,y,pw,Math.max(0,h-y));
      c.fillStyle=q.kind==='finish'?'#f4d99c':'#91b4a7';c.fillRect(x-2,y-4,pw+4,7);
      c.fillStyle=q.kind==='finish'?'#fff0c5':'#d3e1c7';c.fillRect(x,y-4,pw,2);
      c.fillStyle='rgba(240,190,140,.5)';
      const windows=Math.min(7,Math.floor(pw/25));
      for(let i=0;i<windows;i++)c.fillRect(x+9+i*(pw-18)/Math.max(1,windows),y+24,5,9);
    }
    for(const hzd of this.hazards){
      if(!visible(hzd.x))continue;
      const x=this.sx(hzd.x),y=this.sy(hzd.y),r=hzd.r*s;
      c.save();c.shadowColor='#ff8068';c.shadowBlur=18;
      c.fillStyle='#f27b65';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.shadowBlur=0;
      c.strokeStyle='#ffe1b5';c.lineWidth=2;c.stroke();
      c.fillStyle='#743e4b';c.beginPath();c.arc(x,y,r*.38,0,Math.PI*2);c.fill();c.restore();
    }
    for(const t of this.targets){
      if(!visible(t.x))continue;
      const x=this.sx(t.x),y=this.sy(t.y),colour=t.type==='boost'?'#ffd18b':t.type==='limited'?'#ff8b78':'#a9f0d5';
      c.save();c.shadowColor=colour;c.shadowBlur=19;
      c.strokeStyle='rgba(8,24,34,.6)';c.lineWidth=9;c.beginPath();c.arc(x,y,15,0,Math.PI*2);c.stroke();
      c.strokeStyle=colour;c.lineWidth=3;c.beginPath();c.arc(x,y,15,0,Math.PI*2);c.stroke();
      c.fillStyle='#fff5df';c.beginPath();c.arc(x,y,3.2,0,Math.PI*2);c.fill();c.restore();
    }
    if(this.rope){
      const px=this.sx(this.player.x),py=this.sy(this.player.y),tx=this.sx(this.rope.target.x),ty=this.sy(this.rope.target.y);
      c.strokeStyle='rgba(10,25,35,.55)';c.lineWidth=5;c.beginPath();c.moveTo(px+1,py+2);c.lineTo(tx+1,ty+2);c.stroke();
      c.strokeStyle='#f6e9c9';c.lineWidth=2;c.beginPath();c.moveTo(px,py);c.lineTo(tx,ty);c.stroke();
      c.fillStyle='#fff0ca';c.beginPath();c.arc(tx,ty,3,0,Math.PI*2);c.fill();
    }
    for(const q of this.particles){
      c.globalAlpha=clamp(q.life/q.max,0,1);c.fillStyle=q.color;
      c.beginPath();c.arc(this.sx(q.x),this.sy(q.y),2.5,0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;this.drawPlayer(c);c.restore();
  }
  drawPlayer(c){
    const p=this.player,x=this.sx(p.x),y=this.sy(p.y),r=p.r*this.scale;
    let fill=hex(this.cosmetic.color);
    if(this.cosmetic.rainbow){
      const g=c.createLinearGradient(x-r,y-r,x+r,y+r);
      g.addColorStop(0,'#ed806c');g.addColorStop(.25,'#f5bf70');g.addColorStop(.5,'#b7edc9');g.addColorStop(.75,'#80b8df');g.addColorStop(1,'#b49ad1');
      fill=g;
    }
    c.fillStyle='#172038';c.beginPath();c.ellipse(x,y+2,r+3,r+3,0,0,Math.PI*2);c.fill();
    c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    c.strokeStyle='#fff0d8';c.lineWidth=2;c.stroke();
    c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.ellipse(x-r*.28,y-r*.34,r*.22,r*.12,-.5,0,Math.PI*2);c.fill();
  }
  animate(now){
    if(!this.running)return;
    const raw=Math.min(.05,Math.max(0,(now-this.lastTime)/1000||0));this.lastTime=now;this.accumulator=(this.accumulator||0)+raw;
    const fps=this.maxFPS;if(!this.paused&&(!fps||!this.lastRender||now-this.lastRender>=1000/fps)){const dt=Math.min(.05,this.accumulator);this.accumulator=0;this.update(dt);this.draw();this.lastRender=now;}
    else if(this.paused&&this.pauseNeedsDraw){this.draw();this.pauseNeedsDraw=false;}
    this.raf=requestAnimationFrame(t=>this.animate(t));
  }
  complete(){if(this.completed||this.dead)return;this.completed=true;this.cb.onComplete?.({level:this.levelIndex,time:this.elapsed,distance:this.distance});}
  fail(){if(this.dead||this.completed)return;this.dead=true;this.cb.onFail?.({mode:this.mode,distance:this.distance,height:this.maxHeight});}
  pause(){this.paused=true;this.pauseNeedsDraw=true;}
  resume(){this.paused=false;this.pauseNeedsDraw=false;this.lastTime=performance.now();this.lastRender=0;}
  destroy(){this.running=false;cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.onResize);window.removeEventListener('keydown',this.onKey);window.removeEventListener('keyup',this.onKeyUp);this.canvas.removeEventListener('pointermove',this.onPointerMove);this.canvas.removeEventListener('pointerdown',this.onPointerDown);window.removeEventListener('pointerup',this.onPointerUp);this.canvas.removeEventListener('contextmenu',this.onContext);}
}
