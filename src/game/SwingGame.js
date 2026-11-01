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
  pointerMove(e){this.pointer.x=e.clientX;this.pointer.y=e.clientY;if(this.pointer.down&&this.rope)this.pointerWorldCache=this.pointerWorld(e);}
  pointerDown(e){
    if(e.button!==0&&e.pointerType!=='touch')return;
    this.pointer.down=true;this.canvas.setPointerCapture?.(e.pointerId);this.pointerWorldCache=this.pointerWorld(e);
    if(!this.rope)this.attach();
  }
  pointerUp(){this.pointer.down=false;if(this.rope)this.release();}
  attach(){
    if(!this.running||this.paused||this.dead||this.completed)return;
    const p=this.pointerWorldCache;if(!p)return;
    let best=null,bd=1.9;
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
    p.vx*=Math.pow(this.ground ? .80 : .997,dt*60);p.vy*=Math.pow(.999,dt*60);
    p.vx=clamp(p.vx,-25,25);p.vy=clamp(p.vy,-28,19);
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vx*dt*.9;
    this.ground=false;
    for(const q of this.platforms){
      const left=q.x-q.w/2,right=q.x+q.w/2;
      if(p.x+p.r>left&&p.x-p.r<right&&prevY>=q.y+p.r-.12&&p.y<=q.y+p.r&&p.vy<=0){
        p.y=q.y+p.r;p.vy=0;if(!wasGround)this.cb.onLand?.();this.ground=true;
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
      const cut=this.cameraX-30;this.platforms=this.platforms.filter(q=>q.x+q.w>cut);this.targets=this.targets.filter(t=>t.x>cut);this.hazards=this.hazards.filter(h=>h.x>cut);
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
    const c=this.ctx,w=this.width,h=this.height,s=this.scale;c.save();if(this.cameraShake){c.translate(rand(-1.4,1.4),rand(-1,1));}
    const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#09142b');bg.addColorStop(.58,'#101f3b');bg.addColorStop(1,'#172746');c.fillStyle=bg;c.fillRect(0,0,w,h);
    for(let layer=0;layer<3;layer++){c.fillStyle=['#142b49','#122541','#0d1c34'][layer];c.beginPath();const base=h*(.76+layer*.1);c.moveTo(0,h);for(let x=0;x<=w+30;x+=30){const yy=base+Math.sin(x*.006+layer*2.2)*h*.045+Math.sin(x*.018+layer)*h*.018;c.lineTo(x,yy);}c.lineTo(w,h);c.fill();}
    for(const st of this.stars){const x=(st.x*w-this.cameraX*s*.035)%w,y=st.y*h;c.globalAlpha=st.a*(.8+.2*Math.sin(this.elapsed+st.p));c.fillStyle='#c8eaff';c.beginPath();c.arc((x+w)%w,y,st.r,0,Math.PI*2);c.fill();}c.globalAlpha=1;
    const visible=(x)=>this.sx(x)>-100&&this.sx(x)<w+100;
    if(this.mode==='lava'&&this.lavaY>-50){const y=this.sy(this.lavaY);const lg=c.createLinearGradient(0,y-22,0,y+40);lg.addColorStop(0,'#ffbd4b');lg.addColorStop(.25,'#ff5b37');lg.addColorStop(1,'#a91c35');c.fillStyle=lg;c.fillRect(0,y,w,h-y);c.shadowBlur=24;c.shadowColor='#ff633d';c.strokeStyle='#ffb34e';c.lineWidth=3;c.beginPath();c.moveTo(0,y);for(let x=0;x<=w;x+=18)c.lineTo(x,y+Math.sin(x*.025+this.elapsed*3)*5);c.stroke();c.shadowBlur=0;}
    for(const q of this.platforms){if(!visible(q.x))continue;const x=this.sx(q.x-q.w/2),y=this.sy(q.y),pw=q.w*s;
      c.shadowBlur=18;c.shadowColor=q.kind==='finish'?'#54f2d5':'#36bde0';
      const fill=c.createLinearGradient(x,y,x,y+22);fill.addColorStop(0,q.kind==='finish'?'#4ef0d0':'#355b87');fill.addColorStop(1,'#172b4a');
      this.roundRect(x,y,pw,13,6,fill,q.kind==='finish'?'#a1fff0':'#6bdcf0');
      c.shadowBlur=0;c.fillStyle='#101c32';c.fillRect(x+8,y+13,Math.max(0,pw-16),5);
      c.fillStyle='#8deaff';for(let k=0;k<Math.min(6,Math.floor(pw/35));k++)c.fillRect(x+14+k*35,y+4,12,2);
    }
    for(const hzd of this.hazards){if(!visible(hzd.x))continue;const x=this.sx(hzd.x),y=this.sy(hzd.y),r=hzd.r*s;c.save();c.shadowBlur=18;c.shadowColor='#ff4e77';c.strokeStyle='#ff6687';c.lineWidth=7;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.shadowBlur=0;c.strokeStyle='#ffc0ce';c.lineWidth=2;c.beginPath();c.arc(x,y,r-5,0,Math.PI*2);c.stroke();c.restore();}
    for(const t of this.targets){if(!visible(t.x))continue;const x=this.sx(t.x),y=this.sy(t.y),pulse=1+Math.sin(this.elapsed*4+t.phase)*.12,col=t.type==='boost'?'#ffd16a':t.type==='limited'?'#ff80bc':'#61efff';c.save();c.translate(x,y);c.scale(pulse,pulse);c.shadowBlur=26;c.shadowColor=col;c.strokeStyle=col;c.lineWidth=3;c.beginPath();c.arc(0,0,15,0,Math.PI*2);c.stroke();c.fillStyle=col;c.globalAlpha=.2;c.beginPath();c.arc(0,0,11,0,Math.PI*2);c.fill();c.globalAlpha=1;c.fillStyle='#efffff';c.beginPath();c.arc(0,0,4,0,Math.PI*2);c.fill();c.restore();}
    if(this.rope){const x1=this.sx(this.player.x),y1=this.sy(this.player.y),x2=this.sx(this.rope.target.x),y2=this.sy(this.rope.target.y);c.save();c.shadowBlur=12;c.shadowColor='#5cecf5';c.strokeStyle='#a2faff';c.lineWidth=3;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore();}
    for(const q of this.particles){const x=this.sx(q.x),y=this.sy(q.y);c.globalAlpha=clamp(q.life/q.max,0,1);c.fillStyle=q.color;c.beginPath();c.arc(x,y,Math.max(1,4*q.life/q.max),0,Math.PI*2);c.fill();}c.globalAlpha=1;
    this.drawPlayer(c);
    if(this.mode==='levels'){const end=this.platforms[this.platforms.length-1];const x=this.sx(end.x),y=this.sy(end.y);if(x>w*.6){c.globalAlpha=.5;c.fillStyle='#8af8e7';c.font='800 11px sans-serif';c.textAlign='center';c.fillText('FINISH',x,y-30);c.globalAlpha=1;}}
    c.restore();
  }
  drawPlayer(c){
    const p=this.player,x=this.sx(p.x),y=this.sy(p.y),r=p.r*this.scale;
    c.save();c.translate(x,y);c.rotate(p.rot);
    if(this.cosmetic.rainbow){const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#ff557a');g.addColorStop(.25,'#ffca55');g.addColorStop(.5,'#55edc5');g.addColorStop(.75,'#5e8cff');g.addColorStop(1,'#d36cff');c.fillStyle=g;}else c.fillStyle=hex(this.cosmetic.color);
    c.shadowBlur=25;c.shadowColor=this.cosmetic.rainbow?'#c77bff':hex(this.cosmetic.color);c.strokeStyle='#d9ffff';c.lineWidth=2;
    const shape=this.cosmetic.shape;
    c.beginPath();
    if(shape==='cube'||shape==='rounded-cube'){c.roundRect(-r*.78,-r*.78,r*1.56,r*1.56,shape==='cube'?4:r*.3);}
    else if(shape==='diamond'||shape==='octahedron'||shape==='crystal'){c.moveTo(0,-r);c.lineTo(r*.8,0);c.lineTo(0,r);c.lineTo(-r*.8,0);c.closePath();}
    else if(shape==='hexagon'){for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();}
    else if(shape==='star'){for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.42:r;i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();}
    else if(shape==='heart'){c.moveTo(0,r*.8);c.bezierCurveTo(-r*1.4,0,-r*.8,-r,0,-r*.35);c.bezierCurveTo(r*.8,-r,r*1.4,0,0,r*.8);}
    else c.arc(0,0,r,0,Math.PI*2);
    c.closePath();c.fill();c.stroke();c.shadowBlur=0;c.fillStyle='#ffffffaa';c.beginPath();c.ellipse(-r*.28,-r*.34,r*.22,r*.11,-.5,0,Math.PI*2);c.fill();c.restore();
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
