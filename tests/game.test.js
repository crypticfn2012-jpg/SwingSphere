import test from 'node:test';
import assert from 'node:assert/strict';
import { SwingGame } from '../src/game/SwingGame.js';
import { LEVELS } from '../src/game/level-data.js';
import { ITEMS } from '../src/systems/cosmetics.js';

function makeContext(){
  const gradient={addColorStop(){}};
  return new Proxy({
    createLinearGradient(){return gradient;}
  },{
    get(target,key){
      if(key in target)return target[key];
      if(typeof key==='symbol')return undefined;
      const fn=()=>{};
      target[key]=fn;
      return fn;
    },
    set(target,key,value){target[key]=value;return true;}
  });
}

async function makeGame(){
  const callbacks=[];
  const previous={
    window:globalThis.window,
    requestAnimationFrame:globalThis.requestAnimationFrame,
    cancelAnimationFrame:globalThis.cancelAnimationFrame
  };
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.requestAnimationFrame=callback=>{callbacks.push(callback);return callbacks.length;};
  globalThis.cancelAnimationFrame=()=>{};
  const context=makeContext();
  const canvas={
    clientWidth:960,
    clientHeight:540,
    getContext(){return context;},
    addEventListener(){},
    removeEventListener(){},
    setPointerCapture(){},
    getBoundingClientRect(){return {left:0,top:0,width:960,height:540};}
  };
  const game=new SwingGame(canvas);
  await game.init();
  return {
    game,
    callbacks,
    restore(){
      game.destroy();
      if(previous.window===undefined)delete globalThis.window;else globalThis.window=previous.window;
      if(previous.requestAnimationFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous.requestAnimationFrame;
      if(previous.cancelAnimationFrame===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=previous.cancelAnimationFrame;
    }
  };
}

test('campaign contains 100 playable routes',()=>{
  assert.equal(LEVELS.length,100);
  for(const level of LEVELS){
    assert.ok(level.platforms.length>=3);
    assert.ok(level.targets.length>=2);
    assert.ok(Number.isFinite(level.par)&&level.par>0);
  }
});

test('first animation frame updates and draws at the default 60 FPS cap',async()=>{
  const setup=await makeGame();
  try{
    const {game}=setup;
    game.buildLevel(0);
    const before=game.elapsed;
    game.animate(game.lastTime+17);
    assert.ok(game.elapsed>before,'physics should advance on the first frame');
    assert.ok(game.lastRender>0,'the first rendered frame should set lastRender');
  }finally{setup.restore();}
});

test('the final roadmap level can be loaded without clamping to level ten',async()=>{
  const setup=await makeGame();
  try{
    const {game}=setup;
    game.buildLevel(99);
    assert.equal(game.levelIndex,99);
    assert.ok(game.platforms.length>0);
    assert.ok(game.targets.length>0);
  }finally{setup.restore();}
});

test('holding on an anchor attaches the ball to the rope',async()=>{
  const setup=await makeGame();
  try{
    const {game}=setup;
    game.buildLevel(0);
    const anchor=game.targets[0];
    game.pointerWorldCache={x:anchor.x,y:anchor.y};
    game.attach();
    assert.equal(game.rope?.target,anchor);
  }finally{setup.restore();}
});

test('every tenth story level grants a distinct ball skin',()=>{
  const rewards=ITEMS.filter(item=>Number.isInteger(item.unlockLevel)&&item.unlockLevel>0);
  assert.deepEqual(rewards.map(item=>item.unlockLevel),[10,20,30,40,50,60,70,80,90,100]);
  assert.ok(rewards.every(item=>item.type==='color'&&item.price===0));
});

test('endless mode builds a usable chain of swing anchors',async()=>{
  const setup=await makeGame();
  try{
    const {game}=setup;
    game.buildEndless();
    assert.equal(game.mode,'endless');
    assert.ok(game.targets.length>=8);
    for(const anchor of game.targets){
      assert.equal(anchor.x,anchor.bx);
      assert.equal(anchor.y,anchor.by);
    }
  }finally{setup.restore();}
});
