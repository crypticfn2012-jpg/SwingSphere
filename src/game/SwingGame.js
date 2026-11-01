import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LEVELS } from './level-data.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const colorHex=c=>typeof c==='number'?c:new THREE.Color(c).getHex();
export class SwingGame{
  constructor(canvas,callbacks={}){this.canvas=canvas;this.cb=callbacks;this.running=false;this.mode='levels';this.levelIndex=0;this.keys={};this.mouse=new THREE.Vector2();this.targets=[];this.platforms=[];this.hazards=[];this.elapsed=0;this.distance=0;this.best=0;this.lavaY=-20;this.lavaSpeed=1.05;this.rope=null;this.trail=[];this.trailPool=[];this.trailCursor=0;this.trailClock=0;this.trailKind='default';this.rainbowSkin=false;this.lastTime=0;this.lastRender=0;this.maxFPS=60;this.accumulator=0;this.fixed=1/60;this.tmp=new THREE.Vector3();this.onKey=e=>this.key(e,true);this.onKeyUp=e=>this.key(e,false);this.onMove=e=>this.pointer(e);this.onDown=e=>this.pointerDown(e);this.onUp=()=>this.release();this.onContext=e=>e.preventDefault();}
  async init(){
    await RAPIER.init();
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#09142b');this.scene.fog=new THREE.FogExp2('#09142b',.012);
    this.camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,500);this.baseFov=75;this.cameraDistance=8;this.camera.position.set(0,6,12);
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.scene.add(new THREE.HemisphereLight(0xa9d9ff,0x18213d,2));
    const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(-12,24,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);this.scene.add(sun);
    this.world=new RAPIER.World({x:0,y:-17,z:0});this.world.timestep=this.fixed;
    this.playerBody=null;this.playerMesh=null;this.ropeLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,0,0)]),new THREE.LineBasicMaterial({color:0x6df7ff,transparent:true,opacity:.95}));this.ropeLine.visible=false;this.scene.add(this.ropeLine);this.ropeLine.geometry.dispose();this.ropeLine.geometry=new THREE.BufferGeometry();this.ropeLine.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));this.trailGeometry=new THREE.SphereGeometry(.12,8,6);for(let i=0;i<48;i++){const material=new THREE.MeshBasicMaterial({color:0x5ce5ed,transparent:true,opacity:.7,depthWrite:false});const particle=new THREE.Mesh(this.trailGeometry,material);particle.visible=false;this.scene.add(particle);this.trailPool.push({mesh:particle,life:0});}
    this.makeBackdrop();this.bind();this.applyQuality('high');this.resize();this.running=true;this.animate(0);return this;
  }
  makeBackdrop(){
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.MeshStandardMaterial({color:0x101d38,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-28;this.scene.add(floor);
    const grid=new THREE.GridHelper(400,80,0x28476b,0x1b2c4a);grid.position.y=-27.8;this.scene.add(grid);
    const geo=new THREE.BufferGeometry(),pts=[];for(let i=0;i<500;i++){pts.push((Math.random()-.5)*180,Math.random()*90-15,(Math.random()-.5)*180);}
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));this.stars=new THREE.Points(geo,new THREE.PointsMaterial({color:0x8fc9ff,size:.16,transparent:true,opacity:.65}));this.scene.add(this.stars);
  }
  setFrameRate(fps){this.maxFPS=Number(fps)||0;}
  bind(){window.addEventListener('keydown',this.onKey);window.addEventListener('keyup',this.onKeyUp);this.canvas.addEventListener('pointermove',this.onMove);this.canvas.addEventListener('pointerdown',this.onDown);window.addEventListener('pointerup',this.onUp);this.canvas.addEventListener('contextmenu',this.onContext);window.addEventListener('resize',()=>this.resize());}
  key(e,down){if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();this.keys[e.code]=down;if(down&&!e.repeat){if(e.code==='KeyR')this.restart();if(e.code==='Escape')this.cb.onPause?.();if(e.code==='Space')this.jump();}}
  pointer(e){const r=this.canvas.getBoundingClientRect();const sensitivity=this.sensitivity||1;this.mouse.x=clamp((((e.clientX-r.left)/r.width)*2-1)*sensitivity,-1,1);this.mouse.y=clamp((-((e.clientY-r.top)/r.height)*2+1)*sensitivity,-1,1);}
  pointerDown(e){if(e.button!==0)return;this.pointer(e);this.attach();}
  resize(){if(!this.renderer)return;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.quality==='low'?1:1.7));}
  applyQuality(q){this.quality=q;if(this.renderer){this.renderer.shadowMap.enabled=q!=='low';this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='low'?1:q==='medium'?1.25:1.7));}}
  clearCourse(){if(this.lavaMesh){this.scene.remove(this.lavaMesh);this.lavaMesh.geometry.dispose();this.lavaMesh.material.dispose();this.lavaMesh=null;}for(const o of [...this.platforms,...this.targets,...this.hazards]){this.scene.remove(o.mesh);o.mesh.geometry?.dispose();if(Array.isArray(o.mesh.material))o.mesh.material.forEach(m=>m.dispose());else o.mesh.material?.dispose();if(o.body)this.world.removeRigidBody(o.body);}this.platforms=[];this.targets=[];this.hazards=[];this.rope=null;this.ropeLine.visible=false;}
  addPlatform(x,y,z,w,h,d,kind='normal'){
    const mat=new THREE.MeshStandardMaterial({color:kind==='finish'?0x3ee5cf:kind==='checkpoint'?0x6c8cff:0x273c63,metalness:.35,roughness:.45,emissive:kind==='finish'?0x0b6b64:0x08162d,emissiveIntensity:.7});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z));this.world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2),body);
    this.platforms.push({mesh,body,x,y,z,w,h,d,kind});return mesh;
  }
  addTarget(x,y,z,type='standard',moving=false){
    const c=type==='boost'?0xffc85b:type==='limited'?0xff78bd:0x54e8f1;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.95,.95,.95),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.8,metalness:.4,roughness:.22}));
    mesh.position.set(x,y,z);mesh.castShadow=true;this.scene.add(mesh);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.82,.035,8,28),new THREE.MeshBasicMaterial({color:c}));mesh.add(halo);halo.rotation.x=Math.PI/2;
    this.targets.push({mesh,base:V(x,y,z),type,moving,phase:Math.random()*6.28});return mesh;
  }
  addHazard(x,y,z,r=1.5){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,.22,10,28),new THREE.MeshStandardMaterial({color:0xff526e,emissive:0x8b122e,emissiveIntensity:1.1}));mesh.position.set(x,y,z);mesh.rotation.x=Math.PI/2;this.scene.add(mesh);this.hazards.push({mesh,r});}
  buildLevel(index){
    this.mode='levels';this.levelIndex=clamp(index,0,9);this.clearCourse();const L=LEVELS[this.levelIndex];
    L.platforms.forEach((p,i)=>this.addPlatform(p[0],p[1],p[2],p[3],p[4],p[5],i===L.platforms.length-1?'finish':i===0?'checkpoint':'normal'));
    L.targets.forEach((p,i)=>this.addTarget(p[0],p[1],p[2],this.levelIndex===4&&i===1?'boost':'standard',this.levelIndex===2&&i===1));
    L.obstacles.forEach(h=>this.addHazard(h[0],h[1],h[2],h[3]));
    this.resetPlayer();this.levelLength=Math.abs(L.platforms[L.platforms.length-1][2]);this.lavaY=-100;
    this.cb.onLevel?.(L,this.levelIndex);
  }
  buildEndless(){
    this.mode='endless';this.clearCourse();this.endlessZ=0;this.endlessDifficulty=0;
    this.addPlatform(0,0,0,13,1,13,'checkpoint');for(let i=0;i<6;i++)this.generateEndlessSection(i);
    this.resetPlayer();this.levelLength=1e9;this.lavaY=-100;this.cb.onMode?.('endless');
  }
  generateEndlessSection(i){
    const z=-18-i*17,x=(Math.random()-.5)*13,y=1+Math.random()*3+Math.min(i*.16,8);
    this.addPlatform(x,y,z,7+Math.random()*3,1,7);
    this.addTarget(x+(Math.random()-.5)*5,y+5,z+4,Math.random()<.14?'boost':'standard',Math.random()<.35);
    if(i>2&&Math.random()<.48)this.addHazard(x,y+2,z-4,1.2);
  }
  buildLava(){
    this.mode='lava';this.clearCourse();this.lavaY=-12;this.lavaSpeed=1.05;this.lavaZ=0;this.lavaGenerated=9;
    this.addPlatform(0,0,0,13,1,13,'checkpoint');
    for(let i=0;i<9;i++){const z=-14-i*12,x=(Math.random()-.5)*11,y=2+i*3.3;this.addPlatform(x,y,z,7,1,7);this.addTarget(x+(Math.random()-.5)*4,y+4,z+3,i%4===0?'boost':'standard',i%3===0);if(i%2===1)this.addHazard(x,y+1.5,z-3,1.1);}
    this.lavaMesh=new THREE.Mesh(new THREE.BoxGeometry(100,.5,150),new THREE.MeshStandardMaterial({color:0xff4c1d,emissive:0xff2600,emissiveIntensity:2.1,transparent:true,opacity:.9}));this.lavaMesh.position.set(0,this.lavaY,-50);this.scene.add(this.lavaMesh);
    this.resetPlayer();this.levelLength=1e9;this.cb.onMode?.('lava');
  }
  generateLavaSection(i){
    const y=2+i*3.3,z=-14-i*12,x=(Math.random()-.5)*11;
    this.addPlatform(x,y,z,6.5,1,6.5);
    this.addTarget(x+(Math.random()-.5)*4,y+4,z+3,i%4===0?'boost':'standard',i%3===0);
    if(i%2===1)this.addHazard(x,y+1.5,z-3,1.05);
  }
  cleanupEndless(playerZ){
    const cutoff=playerZ+38;
    for(const key of ['platforms','targets','hazards']){
      const keep=[];
      for(const o of this[key]){
        if(o.mesh.position.z>cutoff){this.scene.remove(o.mesh);o.mesh.geometry?.dispose();if(Array.isArray(o.mesh.material))o.mesh.material.forEach(m=>m.dispose());else o.mesh.material?.dispose();if(o.body)this.world.removeRigidBody(o.body);}
        else keep.push(o);
      }
      this[key]=keep;
    }
  }
  resetPlayer(){
    if(this.playerBody)this.world.removeRigidBody(this.playerBody);if(this.playerMesh)this.scene.remove(this.playerMesh);
    this.playerBody=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1.8,2).setLinearDamping(.08).setAngularDamping(.5).setCcdEnabled(true));
    this.playerCollider=this.world.createCollider(RAPIER.ColliderDesc.ball(.72).setDensity(1.2).setFriction(.65).setRestitution(.12),this.playerBody);
    this.playerMesh=new THREE.Mesh(new THREE.SphereGeometry(.72,32,24),new THREE.MeshStandardMaterial({color:0x52e3ed,metalness:.35,roughness:.2,emissive:0x0b6975,emissiveIntensity:.5}));this.playerMesh.castShadow=true;this.scene.add(this.playerMesh);
    this.elapsed=0;this.distance=0;this.dead=false;this.completed=false;this.jumpReady=true;this.trail=[];
    this.camera.position.set(0,5,12);this.camera.lookAt(0,1,0);this.cb.onRunStart?.();
  }
  setCosmetic(item){if(!this.playerMesh||!item)return;if(item.type==='color'){this.rainbowSkin=item.id==='color-rainbow';this.playerMesh.material.color.set(item.color);this.playerMesh.material.emissive.set(item.color);this.playerMesh.material.emissiveIntensity=this.rainbowSkin?.8:.35;}if(item.type==='trail'){this.trailKind=item.id.replace('trail-','');}if(item.type==='shape'){const old=this.playerMesh.geometry;let g;if(item.id==='shape-cube')g=new THREE.BoxGeometry(1.12,1.12,1.12);else if(item.id==='shape-rounded-cube')g=new RoundedBoxGeometry(1.12,1.12,1.12,4,.12);else if(item.id==='shape-diamond'||item.id==='shape-octahedron')g=new THREE.OctahedronGeometry(.9);else if(item.id==='shape-hexagon')g=new THREE.CylinderGeometry(.72,.72,.95,6);else if(item.id==='shape-crystal')g=new THREE.IcosahedronGeometry(.85,1);else if(item.id==='shape-star'||item.id==='shape-heart'){const s=new THREE.Shape();if(item.id==='shape-star'){for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.38:.85,x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();}else{s.moveTo(0,-.65);s.bezierCurveTo(-1.2,.05,-.65,1.1,0,.48);s.bezierCurveTo(.65,1.1,1.2,.05,0,-.65);}g=new THREE.ExtrudeGeometry(s,{depth:.28,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.06,bevelThickness:.06});g.center();}else if(item.id==='shape-neon-sphere')g=new THREE.SphereGeometry(.72,24,18);else g=new THREE.SphereGeometry(.72,32,24);this.playerMesh.geometry=g;old.dispose();if(this.playerCollider&&this.playerBody){this.world.removeCollider(this.playerCollider,true);const desc=item.id==='shape-cube'||item.id==='shape-rounded-cube'?RAPIER.ColliderDesc.cuboid(.62,.62,.62):RAPIER.ColliderDesc.ball(.72);this.playerCollider=this.world.createCollider(desc.setDensity(1.2).setFriction(.65).setRestitution(.12),this.playerBody);}}}
  attach(){
    if(!this.running||this.dead||this.rope)return;
    const ray=new THREE.Raycaster();ray.setFromCamera(this.mouse,this.camera);const hits=ray.intersectObjects(this.targets.map(t=>t.mesh),false);if(!hits.length)return;
    const hit=hits[0],p=this.playerBody.translation(),d=Math.hypot(hit.point.x-p.x,hit.point.y-p.y,hit.point.z-p.z);if(d>30)return;
    const target=this.targets.find(t=>t.mesh===hit.object);if(!target)return;
    this.rope={target,length:Math.max(3,d),point:hit.point.clone()};if(target.type==='boost'){const v=this.playerBody.linvel();this.playerBody.applyImpulse({x:(p.x-target.mesh.position.x)*2,y:5,z:-12},true);}
    this.cb.onSwing?.();
  }
  release(){if(this.rope){this.rope=null;this.ropeLine.visible=false;this.cb.onRelease?.();}}
  jump(){if(!this.playerBody||this.dead||!this.jumpReady)return;const p=this.playerBody.translation();const grounded=this.platforms.some(q=>Math.abs(p.x-q.x)<q.w/2+.6&&Math.abs(p.z-q.z)<q.d/2+.6&&p.y>q.y&&p.y<q.y+2.1);if(grounded){this.playerBody.applyImpulse({x:0,y:8.8,z:0},true);this.jumpReady=false;setTimeout(()=>this.jumpReady=true,250);}}
  constrainRope(){
    if(!this.rope)return;const t=this.rope.target.mesh.position,p=this.playerBody.translation();const dx=p.x-t.x,dy=p.y-t.y,dz=p.z-t.z;const d=Math.hypot(dx,dy,dz)||.001;if(d<=this.rope.length)return;
    const nx=dx/d,ny=dy/d,nz=dz/d;const excess=d-this.rope.length;
    this.playerBody.setTranslation({x:p.x-nx*excess,y:p.y-ny*excess,z:p.z-nz*excess},true);
    const v=this.playerBody.linvel(),radial=v.x*nx+v.y*ny+v.z*nz;if(radial>0)this.playerBody.setLinvel({x:v.x-nx*radial,y:v.y-ny*radial,z:v.z-nz*radial},true);
  }
  update(dt){
    if(!this.playerBody||this.dead||this.completed)return;this.elapsed+=dt;
    const p=this.playerBody.translation(),v=this.playerBody.linvel();
    const forward=V(0,0,-1).applyQuaternion(this.camera.quaternion);forward.y=0;forward.normalize();const right=V(1,0,0).applyQuaternion(this.camera.quaternion);right.y=0;right.normalize();
    let ix=0,iz=0;if(this.keys.KeyW||this.keys.ArrowUp){ix+=forward.x;iz+=forward.z;}if(this.keys.KeyS||this.keys.ArrowDown){ix-=forward.x;iz-=forward.z;}if(this.keys.KeyA||this.keys.ArrowLeft){ix-=right.x;iz-=right.z;}if(this.keys.KeyD||this.keys.ArrowRight){ix+=right.x;iz+=right.z;}
    const l=Math.hypot(ix,iz);if(l>0)this.playerBody.applyImpulse({x:ix/l*dt*8,y:0,z:iz/l*dt*8},true);
    for(const target of this.targets){if(target.moving){target.mesh.position.x=target.base.x+Math.sin(this.elapsed*1.5+target.phase)*2;target.mesh.position.y=target.base.y+Math.cos(this.elapsed*1.2+target.phase)*.8;}}if(this.rope){const target=this.rope.target;this.rope.point.copy(target.mesh.position);}
    this.world.step();this.constrainRope();
    const now=this.playerBody.translation();this.playerMesh.position.set(now.x,now.y,now.z);this.playerMesh.rotation.x+=v.z*dt*.4;this.playerMesh.rotation.z-=v.x*dt*.4;
    const speed=Math.hypot(v.x,v.y,v.z);this.distance=Math.max(this.distance,Math.max(0,-now.z));if(this.mode==='lava'){this.lavaY+=this.lavaSpeed*dt;this.lavaMesh.position.y=this.lavaY;this.lavaSpeed+=dt*.012;if(now.y<this.lavaY+1.1){this.fail();return;}}
    if(this.mode==='endless'){while(-now.z>this.endlessZ+65){this.endlessZ+=17;this.generateEndlessSection(this.endlessZ/17+5);}this.cleanupEndless(now.z);}if(this.mode==='lava'){while(now.y>this.lavaGenerated*3.3-10){this.generateLavaSection(this.lavaGenerated++);}}
    if(now.y<-22||Math.abs(now.x)>95||now.z>28){this.fail();return;}
    for(const h of this.hazards){if(h.mesh.position.distanceTo(this.playerMesh.position)<h.r+.65){this.fail();return;}}
    if(this.mode==='levels'){const end=LEVELS[this.levelIndex].platforms.at(-1);if(now.z<end[2]-2&&Math.abs(now.x-end[0])<end[3]/2+1&&now.y<end[1]+4){this.complete();return;}}
    const cameraDistance=this.cameraDistance||8;const desired=V(now.x*.48+this.camera.position.x*.52,now.y+cameraDistance*.58,now.z+cameraDistance*1.28);this.camera.position.lerp(desired,1-Math.pow(.001,dt));this.camera.lookAt(now.x,now.y+.6,now.z-3);if(this.cameraShake&&speed>18){this.camera.position.x+=(Math.random()-.5)*.035;this.camera.position.y+=(Math.random()-.5)*.025;}const baseFov=this.baseFov||75;this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,clamp(baseFov+Math.max(0,speed-12)*.48,baseFov,105),Math.min(1,dt*3));this.camera.updateProjectionMatrix();
    this.ropeLine.visible=!!this.rope;if(this.rope){const a=this.playerMesh.position,b=this.rope.target.mesh.position;const attr=this.ropeLine.geometry.attributes.position;attr.setXYZ(0,a.x,a.y,a.z);attr.setXYZ(1,b.x,b.y,b.z);attr.needsUpdate=true;}
    if(this.rainbowSkin)this.playerMesh.material.color.setHSL((this.elapsed*.18)%1,.9,.62);
    this.targets.forEach(t=>{t.mesh.rotation.x+=dt*.7;t.mesh.rotation.y+=dt*1.1;});this.trailClock+=dt;if(this.trailKind!=='default'&&this.trailClock>.045){this.trailClock=0;const item=this.trailPool[this.trailCursor++%this.trailPool.length];item.mesh.position.copy(this.playerMesh.position);item.mesh.position.z+=.5;item.life=.65;item.mesh.visible=true;const palette={rainbow:0xff72bd,fire:0xff653b,ice:0x8beaff,lightning:0xffe56b,neon:0x66ffcc,stars:0xf7e5a3,bubbles:0x8cdcff,pixel:0x9d8aff,plasma:0xd56cff};item.mesh.material.color.setHex(palette[this.trailKind]||0x5ce5ed);}for(const item of this.trailPool){if(item.life>0){item.life-=dt;item.mesh.material.opacity=Math.max(0,item.life/.65)*.7;item.mesh.scale.setScalar(.35+Math.max(0,item.life/.65)*.65);}else item.mesh.visible=false;}
    this.cb.onHUD?.({time:this.elapsed,speed,distance:this.distance,height:Math.max(0,now.y),rope:!!this.rope,mode:this.mode});
  }
  complete(){if(this.completed||this.dead)return;this.completed=true;this.release();this.cb.onComplete?.({time:this.elapsed,distance:this.distance,level:this.levelIndex});}
  fail(){if(this.dead||this.completed)return;this.dead=true;this.release();this.cb.onFail?.({time:this.elapsed,distance:this.distance,height:Math.max(0,this.playerBody.translation().y),mode:this.mode});}
  restart(){if(this.mode==='levels')this.buildLevel(this.levelIndex);else if(this.mode==='endless')this.buildEndless();else this.buildLava();}
  animate(time){if(!this.running)return;if(this.maxFPS>0&&time-this.lastRender<1000/this.maxFPS){requestAnimationFrame(t=>this.animate(t));return;}this.lastRender=time;const dt=Math.min((time-this.lastTime)/1000||0,.05);this.lastTime=time;if(!this.paused){this.accumulator+=dt;while(this.accumulator>=this.fixed){this.update(this.fixed);this.accumulator-=this.fixed;}}this.renderer.render(this.scene,this.camera);requestAnimationFrame(t=>this.animate(t));}
  pause(){this.paused=true;}
  resume(){this.paused=false;this.lastTime=performance.now();}
  destroy(){this.running=false;window.removeEventListener('keydown',this.onKey);window.removeEventListener('keyup',this.onKeyUp);this.trailPool.forEach(p=>{this.scene.remove(p.mesh);p.mesh.material.dispose();});this.trailGeometry?.dispose();this.renderer?.dispose();this.world?.free();}
}