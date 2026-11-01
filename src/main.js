import { LEVELS } from './game/level-data.js';
import { SaveManager } from './systems/save.js';
import { ITEMS } from './systems/cosmetics.js';
import { CrazyGames } from './platform/crazygames.js';
import { AudioManager } from './systems/audio.js';
import { LeaderboardManager } from './platform/leaderboards.js';

const app=document.querySelector('#app'),canvas=document.querySelector('#game-canvas'),loading=document.querySelector('#loading-screen');
const save=new SaveManager(),platform=new CrazyGames();
const leaderboardManager=new LeaderboardManager(platform);
const localSave=save.save.bind(save);save.save=()=>{const ok=localSave();platform.saveCloud('swingsphere-profile',save.data);return ok;};
let game=null,screen='menu',activeMode='levels',hudTimer=null,playSeconds=0,shopTab='color',lockerTab='color';
const audio=new AudioManager();
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message,good=false){const el=document.createElement('div');el.className='toast'+(good?' good':'');el.textContent=message;document.querySelector('#toast-layer').append(el);setTimeout(()=>el.remove(),2600);}
function stars(n){return '<span class="stars">'+('★'.repeat(n))+('☆'.repeat(3-n))+'</span>';}
function profile(){const pct=Math.min(100,save.data.xp/save.getLevel()*100);return '<div class="profile"><span>◉</span><span>PLAYER <b>'+save.data.level+'</b><div class="bar" style="width:86px;height:4px;margin-top:5px"><i style="width:'+pct+'%"></i></div></span><span class="muted">LVL</span></div>';}
function currency(){return '<div class="currency">✦ <b>'+save.data.coins.toLocaleString()+'</b> <small>SWINGCOINS</small></div>';}
function setScreen(name){screen=name;platform.gameplayStop();if(game){game.pause();game.canRestart=false;}app.innerHTML='';}
function menu(){
 ensureDailyPlaytime();setScreen('menu');
 const best=Math.floor(save.data.records.endless||0),last=Math.floor(save.data.records.lastEndless||0);
 const dailySeconds=save.data.playtime.dailySeconds||0;
 const completed=Object.keys(save.data.levels).length;
 const next=Array.from({length:LEVELS.length},(_,i)=>i).find(i=>!save.data.levels[i])??LEVELS.length-1;
 const pct=Math.round(completed/LEVELS.length*100);
 app.innerHTML=`<section class="screen title-screen">
  <header class="title-header">
   <div class="game-logo">SWING<span>SPHERE</span><small> A PHYSICS PLATFORMER</small></div>
   <nav class="title-nav">
    <button data-action="locker">LOCKER</button>
    <button data-action="shop">SKIN SHOP</button>
    <button data-action="playtime">DAILY REWARDS</button>
    <button data-action="settings" aria-label="Settings">SETTINGS ⚙</button>
   </nav>
  </header>
  <main class="menu-layout">
   <div class="menu-copy">
    <div class="title-kicker">FIND YOUR MOMENTUM</div>
    <h1>LET GO.<br><span>FLY FURTHER.</span></h1>
    <p class="title-subtitle">One ball. One rope. A lot of bad landings.</p>
    <div class="title-buttons">
     <button class="play-button story-button" data-action="levels"><span>${completed?'CONTINUE STORY':'START STORY'}</span><b>↗</b></button>
     <button class="play-button endless-button" data-action="endless"><span>ENDLESS RUN</span><b>∞</b></button>
    </div>
    <div class="menu-progress">
     <div class="menu-progress-head"><span>YOUR STORY</span><b>${completed} / ${LEVELS.length}</b></div>
     <div class="menu-progress-track"><i style="width:${pct}%"></i></div>
     <small>${pct}% COMPLETE · NEXT UP: ${esc(LEVELS[next].name.toUpperCase())}</small>
    </div>
   </div>
   <div class="menu-art" aria-hidden="true">
    <div class="menu-rope"></div><div class="menu-anchor"></div>
    <div class="menu-ball"></div>
    <span class="menu-art-label">HOLD TO GRAPPLE <i>↗</i></span>
   </div>
  </main>
  <footer class="title-footer">
   <div class="menu-stat"><small>ENDLESS BEST</small><strong>${best}<i>m</i></strong></div>
   <div class="menu-stat"><small>LAST RUN</small><strong>${last}<i>m</i></strong></div>
   <div class="menu-stat"><small>PLAYED TODAY</small><strong>${Math.floor(dailySeconds/60)}<i>min</i></strong></div>
   <div class="menu-hint">HOLD ANYWHERE TO AUTO-GRAPPLE THE NEAREST RING</div>
  </footer>
 </section>`;
}
function levels(){
 setScreen('levels');
 const completedCount=Object.keys(save.data.levels).filter(k=>Number(k)>=0&&Number(k)<LEVELS.length).length;
 const currentLevel=Math.min(LEVELS.length-1,Array.from({length:LEVELS.length},(_,i)=>i).find(i=>!save.data.levels[i])??LEVELS.length-1);
 const chapterNames=['THE FIRST ROOFTOPS','DOWNTOWN','OLD TOWN','NEON MILE','THE HEIGHTS','HARBOUR RUN','MIDNIGHT CITY','SKYLINE','CLOUD DISTRICT','THE SUMMIT'];
 const chapters=Array.from({length:10},(_,chapter)=>{
  const from=chapter*10,to=from+10;
  const skin=ITEMS.find(x=>x.unlockLevel===to);
  const nodes=Array.from({length:10},(_,local)=>{
   const i=from+local,record=save.data.levels[i],unlocked=i===0||!!save.data.levels[i-1];
   const row=local<5?1:2,col=local<5?local+1:10-local;
   const status=record?'done':i===currentLevel?'current':unlocked?'ready':'locked';
   return '<button class="road-node '+status+(local===9?' milestone':'')+'" style="grid-column:'+col+';grid-row:'+row+'" data-action="start-level" data-level="'+i+'" '+(unlocked||record?'':'disabled')+' title="Level '+(i+1)+' · '+esc(LEVELS[i].name)+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+(record?'<small>✓</small>':'')+'</button>';
  }).join('');
  const rewardOwned=skin&&save.data.owned.includes(skin.id);
  return '<section class="chapter-block"><header class="chapter-title"><div><small>CHAPTER '+String(chapter+1).padStart(2,'0')+'</small><h3>'+chapterNames[chapter]+'</h3></div><div class="chapter-reward"><span class="skin-dot" style="--skin:#'+((skin?.color||0x55d8e8).toString(16).padStart(6,'0'))+'"></span><span>'+((rewardOwned)?'SKIN UNLOCKED':'SKIN AT LEVEL '+to)+'</span></div></header><div class="chapter-path"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M10 25 H90 V75 H10"/></svg>'+nodes+'</div></section>';
 }).join('');
 app.innerHTML='<section class="screen sub-screen"><div class="sub-top"><button class="back-button" data-action="menu">← BACK</button><div class="sub-heading"><small>STORY MODE</small><h2>THE ROAD AHEAD</h2><p>'+completedCount+' / '+LEVELS.length+' levels complete</p></div><div class="progress-count">'+Math.round(completedCount/LEVELS.length*100)+'%</div></div><div class="road-scroll">'+chapters+'</div></section>';
}
function shop(){
 setScreen('shop');
 const cards=ITEMS.filter(i=>!i.unlockLevel&&i.price>0).map(i=>{
  const owned=save.data.owned.includes(i.id),equipped=save.data.equipped.color===i.id;
  return '<article class="skin-card"><span class="skin-preview" style="--skin:#'+i.color.toString(16).padStart(6,'0')+'"></span><strong>'+esc(i.name)+'</strong><small>'+i.rarity+'</small><b>'+(owned?'OWNED':'✦ '+i.price)+'</b><button class="skin-action" data-action="'+(owned?'equip':'buy')+'" data-id="'+i.id+'">'+(owned?(equipped?'EQUIPPED':'EQUIP'):'UNLOCK')+'</button></article>';
 }).join('');
 app.innerHTML='<section class="screen sub-screen"><div class="sub-top"><button class="back-button" data-action="menu">← BACK</button><div class="sub-heading"><small>MAKE IT YOURS</small><h2>THE SKIN SHOP</h2><p>Coins earned by playing. No paywalls.</p></div><div class="coin-balance">✦ '+save.data.coins+'</div></div><div class="skin-grid">'+cards+'</div></section>';
}
function locker(){
 setScreen('locker');
 const cards=ITEMS.filter(i=>i.type==='color').map(i=>{
  const owned=save.data.owned.includes(i.id),equipped=save.data.equipped.color===i.id;
  const lockedByLevel=!!i.unlockLevel&&!owned,dailyLocked=!!i.dailyOnly&&!owned;
  const label=owned?(equipped?'EQUIPPED':'EQUIP'):lockedByLevel?'LEVEL '+i.unlockLevel:dailyLocked?'30 MIN DAILY':'SHOP';
  return '<article class="skin-card '+(lockedByLevel?'skin-locked':'')+'"><span class="skin-preview" style="--skin:#'+i.color.toString(16).padStart(6,'0')+'"></span><strong>'+esc(i.name)+'</strong><small>'+(i.unlockLevel?'STORY REWARD':'BALL SKIN')+'</small><button class="skin-action" data-action="'+(owned?'equip':(lockedByLevel||dailyLocked)?'noop':'shop')+'" data-id="'+i.id+'" '+((lockedByLevel||dailyLocked)?'disabled':'')+'>'+label+'</button></article>';
 }).join('');
 app.innerHTML='<section class="screen sub-screen"><div class="sub-top"><button class="back-button" data-action="menu">← BACK</button><div class="sub-heading"><small>YOUR COLLECTION</small><h2>BALL SKINS</h2><p>'+save.data.owned.filter(id=>ITEMS.some(i=>i.id===id)).length+' / '+ITEMS.length+' unlocked</p></div><div class="coin-balance">✦ '+save.data.coins+'</div></div><div class="skin-grid">'+cards+'</div></section>';
}
const ACH=[
['first-swing','First Swing','Attach your rope for the first time',1],['first-landing','First Landing','Finish your first level',1],['five-levels','Getting Good','Complete five levels',5],['ten-levels','Sky Master','Complete all ten levels',10],['three-star','Perfectionist','Earn a three-star rating',1],['speed','Speed Demon','Beat a gold time',1],['endless-100','Endless Runner','Travel 100 metres in Endless',100],['endless-500','Never Stop','Travel 500 metres in Endless',500],['lava-25','Hot Feet','Reach 25 metres in Lava',25],['lava-75','Lava Legend','Reach 75 metres in Lava',75],['collector-5','Collector','Own five cosmetics',5],['collector-20','Fashion Icon','Own twenty cosmetics',20],['swings-50','Web Slinger','Perform 50 swings',50],['swings-200','Rope Pro','Perform 200 swings',200],['play-10','Dedicated','Play for ten minutes',600],['play-60','Committed','Play for one hour',3600],['falls-10','Trial and Error','Fall ten times',10],['coins-1000','Big Saver','Earn 1,000 coins',1000],['level-10','Rising Star','Reach player level 10',10],['rainbow','Colourful','Equip the Rainbow ball',1]
];
function achievements(){
 setScreen('achievements');const cards=ACH.map(a=>{const done=save.data.achievements.includes(a[0]);return '<article class="card"><span class="pill">'+(done?'UNLOCKED':'ACHIEVEMENT')+'</span><strong>'+a[1]+'</strong><small>'+a[2]+'</small><b>'+(done?'✓ COMPLETE':'IN PROGRESS')+'</b></article>';}).join('');
 app.innerHTML='<section class="screen"><div class="panel panel-wrap"><div class="panel-head"><div><div class="eyebrow">MILESTONES</div><h2>Achievements</h2></div><button class="secondary" data-action="menu">✕</button></div><p class="muted">'+save.data.achievements.length+' / '+ACH.length+' unlocked</p><div class="cards">'+cards+'</div></div></section>';
}
function leaderboards(){
 setScreen('leaderboards');const rows=Object.entries(save.data.levels).map(([id,v])=>({name:LEVELS[Number(id)]?.name||'Level',score:v.best})).sort((a,b)=>a.score-b.score);
 app.innerHTML='<section class="screen"><div class="panel panel-wrap"><div class="panel-head"><div><div class="eyebrow">PERSONAL RECORDS</div><h2>Leaderboards</h2></div><button class="secondary" data-action="menu">✕</button></div><p class="muted">These are your saved local records. Global CrazyGames leaderboards are invitation-only and currently support one configured board per game. Total Stars submission activates when the portal encryption key is configured; these local records remain available either way.</p><div class="cards"><article class="card"><strong>ENDLESS DISTANCE</strong><div class="level-no">'+save.data.records.endless.toFixed(0)+'m</div></article><article class="card"><strong>FLOOR IS LAVA</strong><div class="level-no">'+save.data.records.lava.toFixed(0)+'m</div></article><article class="card"><strong>TOTAL STARS</strong><div class="level-no">'+Object.values(save.data.levels).reduce((n,x)=>n+x.stars,0)+'</div></article></div><h3>Best level times</h3><div class="cards">'+(rows.length?rows.map(r=>'<article class="card"><strong>'+esc(r.name)+'</strong><div class="level-no">'+r.score.toFixed(2)+'s</div></article>').join(''):'<p class="muted">Complete a level to set your first record.</p>')+'</div></div></section>';
}
function daily(){
 setScreen('daily');const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),claimed=save.data.daily.lastClaim>=today;const rewards=[100,150,200,250,300,400,0];
 app.innerHTML='<section class="screen"><div class="panel panel-wrap"><div class="panel-head"><div><div class="eyebrow">COME BACK TOMORROW</div><h2>Daily rewards</h2></div><button class="secondary" data-action="menu">✕</button></div><div class="cards">'+rewards.map((r,i)=>'<article class="card"><span class="pill">DAY '+(i+1)+'</span><strong>'+(r?'✦ '+r+' COINS':'EXCLUSIVE COSMETIC')+'</strong><small>'+(i===save.data.daily.streak%7?'YOUR NEXT REWARD':'7 DAY STREAK')+'</small></article>').join('')+'</div><div style="margin-top:22px;text-align:center"><button class="primary" data-action="claim-daily" '+(claimed?'disabled':'')+'>'+(claimed?'ALREADY CLAIMED TODAY':'CLAIM REWARD')+'</button></div></div></section>';
}
function settings(){
 setScreen('settings');const s=save.data.settings;
 app.innerHTML='<section class="screen"><div class="panel panel-wrap"><div class="panel-head"><div><div class="eyebrow">TUNE YOUR EXPERIENCE</div><h2>Settings</h2></div><button class="secondary" data-action="menu">✕</button></div><div class="setting-row"><span>Graphics quality</span><select data-setting="quality"><option '+(s.quality==='low'?'selected':'')+'>low</option><option '+(s.quality==='medium'?'selected':'')+'>medium</option><option '+(s.quality==='high'?'selected':'')+'>high</option><option '+(s.quality==='ultra'?'selected':'')+'>ultra</option></select></div><div class="setting-row"><span>Frame rate cap</span><select data-setting="fps"><option value="30">30 FPS</option><option value="60" '+(s.fps===60?'selected':'')+'>60 FPS</option><option value="120" '+(s.fps===120?'selected':'')+'>120 FPS</option><option value="0" '+(s.fps===0?'selected':'')+'>Unlimited</option></select></div>'+[['grappleRange','Grapple reach',9,20,.5],['cameraDistance','Camera zoom',5,14,1],['master','Master volume',0,1,.05],['music','Music volume',0,1,.05],['sfx','SFX volume',0,1,.05]].map(x=>'<div class="setting-row"><label for="set-'+x[0]+'">'+x[1]+'</label><input id="set-'+x[0]+'" type="range" min="'+x[2]+'" max="'+x[3]+'" step="'+x[4]+'" value="'+s[x[0]]+'" data-setting="'+x[0]+'"></div>').join('')+'<div class="setting-row"><span>Camera shake</span><input type="checkbox" data-setting="cameraShake" '+(s.cameraShake?'checked':'')+'></div><div class="setting-row"><span>Display</span><button class="small-btn" data-action="fullscreen">TOGGLE FULLSCREEN</button></div><div class="menu-actions"><button class="secondary" data-action="reset-settings">RESTORE DEFAULTS</button><button class="primary" data-action="menu">DONE</button></div></div></section>';
}
function hud(){
 app.innerHTML='<div class="hud"><div class="hud-top"><div class="hud-mode" id="hud-mode">STORY · 01</div><div class="hud-time" id="hud-time">0.00</div><button class="hud-pause" data-action="pause" aria-label="Pause">Ⅱ</button></div><div class="hud-bottom"><div id="hud-rope">HOLD ANYWHERE TO AUTO-GRAPPLE</div><strong id="hud-speed">0m</strong><small><kbd>A</kbd><kbd>D</kbd> MOVE <span>·</span> HOLD TO SWING <span>·</span> RELEASE TO FLY</small></div><div class="touch-controls"><button data-control="left" aria-label="Move left">←</button><button data-control="jump">JUMP</button><button data-control="right" aria-label="Move right">→</button></div></div>';
}
function modal(title,description,actions){
 const layer=document.createElement('div');layer.className='modal-screen';layer.innerHTML='<div class="panel modal"><div class="eyebrow">SWINGSPHERE</div><h2>'+title+'</h2><p>'+description+'</p><div class="modal-actions">'+actions+'</div></div>';app.append(layer);return layer;
}
function pause(){if(game?.paused&&document.querySelector('.modal-screen'))return;game?.pause();platform.gameplayStop();modal('PAUSED','Take a breather. Your run is waiting.', '<button class="primary" data-action="resume">RESUME</button><button class="secondary" data-action="restart">RESTART</button><button class="secondary" data-action="menu">MAIN MENU</button>');}
function start(mode,index=0){
 activeMode=mode;game.canRestart=true;if(mode==='levels')game.buildLevel(index);else if(mode==='endless')game.buildEndless();else game.buildLava();
 hud();screen='game';game.resume();platform.gameplayStart();
}
function finishLevel(result){
 game.pause();platform.gameplayStop();
 const L=LEVELS[result.level];if(!L)return;
 const levelNumber=result.level+1;
 const starsEarned=result.time<=L.par*.82?3:result.time<=L.par*1.18?2:1;
 const old=save.data.levels[result.level];
 const reward=90+starsEarned*30+(old?0:60);
 save.levelResult(result.level,result.time,starsEarned,reward);
 const totalStars=Object.values(save.data.levels).reduce((n,x)=>n+x.stars,0);
 leaderboardManager.submitTotalStars(totalStars);
 let skinMessage='';
 if(levelNumber%10===0){
  const rewardSkin=ITEMS.find(i=>i.unlockLevel===levelNumber);
  if(rewardSkin&&!save.data.owned.includes(rewardSkin.id)){
   save.own(rewardSkin.id);skinMessage=' You unlocked the '+rewardSkin.name+' ball skin!';
  }
 }
 unlock('first-landing');unlock('coins-1000');
 if(Object.keys(save.data.levels).length>=5)unlock('five-levels');
 if(Object.keys(save.data.levels).length>=10)unlock('ten-levels');
 const hasNext=result.level<LEVELS.length-1;
 const next=hasNext?'<button class="primary" data-action="next-level">NEXT LEVEL →</button>':'<button class="primary" data-action="levels">VIEW ROADMAP</button>';
 const title=levelNumber%10===0?'SKIN REWARD!':'LEVEL COMPLETE';
 const description=L.name+' · '+result.time.toFixed(2)+' seconds. You earned '+starsEarned+' stars and '+reward+' coins.'+skinMessage;
 modal(title,description,'<div>'+stars(starsEarned)+'</div>'+next+'<button class="secondary" data-action="restart">REPLAY</button><button class="secondary" data-action="menu">MENU</button>');
 audio.play('complete');
}
function gameOver(result){
 game.pause();platform.gameplayStop();audio.play('fail');
 save.data.stats.falls++;unlock('falls-10');
 let earned=0,score=0;
 if(result.mode==='endless'){
  score=Math.floor(result.distance);
  save.data.records.endless=Math.max(save.data.records.endless||0,score);
  save.data.records.lastEndless=score;
  earned=Math.floor(score/3);save.addCoins(earned);save.addXP(Math.floor(score*2));
  unlock('endless-100',score);unlock('endless-500',score);
 }else if(result.mode==='lava'){
  score=Math.floor(result.height);
  save.data.records.lava=Math.max(save.data.records.lava||0,score);
  earned=Math.floor(score*2);save.addCoins(earned);save.addXP(Math.floor(score*2));
  unlock('lava-25',score);unlock('lava-75',score);
 }
 save.save();
 const description=result.mode==='endless'?'You swung '+score+' metres. You earned '+earned+' coins.':'The run is over. You earned '+earned+' coins.';
 modal('RUN OVER',description,'<button class="primary" data-action="restart">TRY AGAIN</button><button class="secondary" data-action="menu">MAIN MENU</button>');
}
function unlock(id,value=1){const a=ACH.find(x=>x[0]===id);if(!a||save.data.achievements.includes(id))return;let ok=false;switch(id){case'first-swing':ok=save.data.stats.swings>=1;break;case'first-landing':ok=save.data.stats.levels>=1;break;case'five-levels':ok=Object.keys(save.data.levels).length>=5;break;case'ten-levels':ok=Object.keys(save.data.levels).length>=10;break;case'three-star':ok=Object.values(save.data.levels).some(x=>x.stars===3);break;case'speed':ok=Object.values(save.data.levels).some(x=>x.stars===3);break;case'endless-100':ok=value>=100;break;case'endless-500':ok=value>=500;break;case'lava-25':ok=value>=25;break;case'lava-75':ok=value>=75;break;case'collector-5':ok=save.data.owned.length>=5;break;case'collector-20':ok=save.data.owned.length>=20;break;case'swings-50':ok=save.data.stats.swings>=50;break;case'swings-200':ok=save.data.stats.swings>=200;break;case'play-10':ok=save.data.playtime.seconds>=600;break;case'play-60':ok=save.data.playtime.seconds>=3600;break;case'falls-10':ok=save.data.stats.falls>=10;break;case'coins-1000':ok=(save.data.stats.coinsEarned||0)>=1000;break;case'level-10':ok=save.data.level>=10;break;case'rainbow':ok=save.data.equipped.color==='color-rainbow';break;}if(ok){save.data.achievements.push(id);save.addCoins(75);save.save();toast('Achievement unlocked: '+a[1],true);}}
function claimDaily(){const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();if(save.data.daily.lastClaim>=today){toast('Already claimed today');return;}if(save.data.daily.lastClaim&&today-save.data.daily.lastClaim>86400000)save.data.daily.streak=0;const day=save.data.daily.streak%7;const rewards=[100,150,200,250,300,400,0];if(day===6){const item=ITEMS.find(i=>i.id==='trail-plasma');if(!save.own(item.id)){toast('Day 7 reward unlocked: Plasma Trail!',true);}else{save.addCoins(400);toast('Duplicate reward converted to 400 coins',true);}}else{save.addCoins(rewards[day]);toast('+'+rewards[day]+' SwingCoins!',true);}save.data.daily.lastClaim=today;save.data.daily.streak++;save.save();daily();}
function buy(id){const item=ITEMS.find(i=>i.id===id);if(!item)return;if(save.data.owned.includes(id)){toast('Already owned');return;}if(save.data.coins<item.price){toast('Not enough SwingCoins');return;}modal('CONFIRM PURCHASE','Unlock '+item.name+' for '+item.price+' SwingCoins?','<button class="primary" data-action="confirm-buy" data-id="'+id+'">CONFIRM · ✦ '+item.price+'</button><button class="secondary" data-action="cancel-modal">CANCEL</button>');}
function confirmBuy(id){const item=ITEMS.find(i=>i.id===id);document.querySelector('.modal-screen')?.remove();if(!item||save.data.owned.includes(id))return;if(!save.spendCoins(item.price)){toast('Not enough SwingCoins');return;}save.own(id);unlock('collector-5');unlock('collector-20');toast(item.name+' unlocked!',true);shop();}
function equip(id){const item=ITEMS.find(i=>i.id===id);if(!item||!save.data.owned.includes(id))return;save.equip(item.type,id);game.setCosmetic(item);unlock('rainbow');toast(item.name+' equipped',true);if(screen==='locker')locker();else if(screen==='shop')shop();}
function applySetting(el){const k=el.dataset.setting;if(!k)return;let v=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;if(k==='fps')v=Number(v);save.data.settings[k]=v;save.save();if(k==='quality')game.applyQuality(v);if(k==='fps')game.setFrameRate(v);if(k==='grappleRange')game.grappleRange=v;if(k==='cameraShake')game.cameraShake=v;if(k==='fov'){game.baseFov=v;game.resize();}if(k==='cameraDistance')game.cameraDistance=v;if(['master','music','sfx'].includes(k))audio.setVolumes(save.data.settings.master,save.data.settings.music,save.data.settings.sfx);}
app.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;audio.play('click');const a=b.dataset.action;
 if(a==='menu')menu();else if(a==='start-quick')start('levels',0);else if(a==='play')levels();else if(a==='levels')levels();else if(a==='locker')locker();else if(a==='shop')shop();else if(a==='achievements')achievements();else if(a==='leaderboards')leaderboards();else if(a==='daily')daily();else if(a==='playtime')playtime();else if(a==='settings')settings();
 else if(a==='start-level')start('levels',Number(b.dataset.level));else if(a==='endless')start('endless');else if(a==='lava')start('lava');
 else if(a==='fullscreen'){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>toast('Fullscreen unavailable'));else document.exitFullscreen?.();}else if(a==='pause')pause();else if(a==='resume'){document.querySelector('.modal-screen')?.remove();game.resume();platform.gameplayStart();}
 else if(a==='restart'){document.querySelector('.modal-screen')?.remove();start(activeMode,game.levelIndex);}
 else if(a==='next-level'){document.querySelector('.modal-screen')?.remove();start('levels',Math.min(LEVELS.length-1,game.levelIndex+1));}
 else if(a==='shop-tab'){shopTab=b.dataset.tab;shop();}else if(a==='locker-tab'){lockerTab=b.dataset.tab;locker();}
 else if(a==='noop'){}else if(a==='buy')buy(b.dataset.id);else if(a==='confirm-buy')confirmBuy(b.dataset.id);else if(a==='cancel-modal')document.querySelector('.modal-screen')?.remove();else if(a==='equip')equip(b.dataset.id);else if(a==='claim-daily')claimDaily();else if(a==='claim-playtime')claimPlaytime(Number(b.dataset.seconds));else if(a==='reward-ad')rewardAd();
 else if(a==='reset-settings'){save.data.settings={...new SaveManager().data.settings};save.save();settings();}
});
app.addEventListener('change',e=>{if(e.target.dataset.setting)applySetting(e.target);});
app.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-control]');if(!b||!game)return;e.preventDefault();if(b.dataset.control==='jump')game.jump();else game.keys[b.dataset.control==='left'?'KeyA':'KeyD']=true;});
window.addEventListener('pointerup',()=>{if(game){game.keys.KeyA=false;game.keys.KeyD=false;}});

function localDayKey(){
 const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ensureDailyPlaytime(){
 const p=save.data.playtime,day=localDayKey();
 if(p.day!==day){p.day=day;p.dailySeconds=0;p.dailyClaimed=[];save.save();}
 if(!Array.isArray(p.dailyClaimed))p.dailyClaimed=[];
}
function playtime(){
 ensureDailyPlaytime();
 setScreen('playtime');
 const seconds=save.data.playtime.dailySeconds||0,claimed=save.data.playtime.dailyClaimed;
 const rewards=[{s:300,c:100,label:'5 MINUTES',detail:'100 coins'},{s:900,c:250,label:'15 MINUTES',detail:'250 coins'},{s:1800,c:0,label:'30 MINUTES',detail:'Exclusive Night Shift skin'}];
 const cards=rewards.map(r=>{
  const done=claimed.includes(r.s),ready=seconds>=r.s,pct=Math.min(100,seconds/r.s*100);
  return '<article class="daily-reward"><div class="daily-reward-top"><small>'+r.label+'</small><span>'+(done?'CLAIMED':r.detail)+'</span></div><div class="daily-progress"><i style="width:'+pct+'%"></i></div><button class="skin-action" data-action="claim-playtime" data-seconds="'+r.s+'" '+(!ready||done?'disabled':'')+'>'+(done?'COLLECTED':ready?'CLAIM REWARD':Math.ceil((r.s-seconds)/60)+' MIN LEFT')+'</button></article>';
 }).join('');
 app.innerHTML='<section class="screen sub-screen"><div class="sub-top"><button class="back-button" data-action="menu">← BACK</button><div class="sub-heading"><small>PLAY A LITTLE, EARN A LITTLE</small><h2>DAILY PLAY REWARDS</h2><p>Today: '+Math.floor(seconds/60)+' minutes played</p></div><div class="progress-count">DAILY</div></div><div class="daily-grid">'+cards+'</div><p class="daily-note">Time counts while you are actively playing. Your progress resets each day.</p></section>';
}
function claimPlaytime(seconds){
 ensureDailyPlaytime();
 const p=save.data.playtime,rewards={300:100,900:250,1800:0};
 if(!Object.prototype.hasOwnProperty.call(rewards,seconds)||p.dailySeconds<seconds||p.dailyClaimed.includes(seconds))return;
 p.dailyClaimed.push(seconds);
 if(seconds===1800){
  const skin=ITEMS.find(i=>i.id==='skin-nightshift');
  if(skin&&!save.data.owned.includes(skin.id)){save.own(skin.id);toast('Night Shift ball skin unlocked!',true);}
  else{save.addCoins(250);toast('+250 coins!',true);}
 }else{save.addCoins(rewards[seconds]);toast('+'+rewards[seconds]+' coins!',true);}
 save.save();playtime();
}
function rewardAd(){
 const previous={...save.data.settings};const started=platform.rewarded(()=>{audio.setVolumes(0,0,0);if(game)game.pause();platform.gameplayStop();},ok=>{audio.setVolumes(previous.master,previous.music,previous.sfx);if(ok){save.addCoins(150);toast('Rewarded ad complete: +150 SwingCoins!',true);}else toast('No ad available right now.');if(screen==='game'){game.resume();platform.gameplayStart();}});
 if(!started)toast('Rewarded ads are only available on CrazyGames.');
}

async function boot(){
 await platform.init();const cloud=await platform.loadCloud('swingsphere-profile');if(cloud&&cloud.version===1&&Number(cloud.updatedAt)>Number(save.data.updatedAt||0)){try{localStorage.setItem('swingsphere.save.v1',JSON.stringify(cloud));save.data=new SaveManager().data;}catch(e){console.warn('Cloud save could not be restored',e);}}platform.loadingStart();try{const {SwingGame}=await import('./game/SwingGame.js');game=new SwingGame(canvas,{onPause:pause,onComplete:finishLevel,onFail:gameOver,onHUD:updateHUD,onSwing:()=>{audio.play('swing');save.data.stats.swings++;save.save();unlock('first-swing');unlock('swings-50');unlock('swings-200');},onJump:()=>audio.play('jump'),onRelease:()=>audio.play('release'),onLand:()=>audio.play('land'),onRestart:()=>{document.querySelector('.modal-screen')?.remove();game.resume();platform.gameplayStart();},onRunStart:()=>{},onLevel:(L,i)=>{const c=save.data.equipped.color;const item=ITEMS.find(x=>x.id===c);if(item)game.setCosmetic(item);},onMode:()=>{}});await game.init();game.buildLevel(0);const item=ITEMS.find(x=>x.id===save.data.equipped.color);if(item)game.setCosmetic(item);game.applyQuality(save.data.settings.quality);game.setFrameRate(save.data.settings.fps);game.grappleRange=save.data.settings.grappleRange||15;game.cameraShake=save.data.settings.cameraShake;game.cameraDistance=save.data.settings.cameraDistance;audio.setVolumes(save.data.settings.master,save.data.settings.music,save.data.settings.sfx);platform.loadingStop();menu();setTimeout(()=>loading.classList.add('done'),250);setInterval(()=>{if(screen==='game'&&!document.hidden&&!game.paused&&!game.dead&&!game.completed){
  ensureDailyPlaytime();playSeconds++;save.data.playtime.seconds++;save.data.playtime.dailySeconds++;
  if(playSeconds%15===0){save.save();platform.saveCloud('swingsphere-profile',save.data);}
  unlock('play-10');unlock('play-60');
 }},1000);document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='game')pause();});}catch(e){console.error(e);loading.innerHTML='<div class="loading-mark">SWING<span>•</span>SPHERE</div><p>Could not start the 2D game. Please refresh and try again.</p>';}}
function updateHUD(d){
 const t=$('hud-time');if(t)t.textContent=d.time.toFixed(1);
 const m=$('hud-mode');if(m)m.textContent=d.mode==='levels'?'STORY · '+String(game.levelIndex+1).padStart(2,'0'):'ENDLESS';
 const s=$('hud-speed');if(s)s.textContent=Math.floor(d.distance)+'m';
 const r=$('hud-rope');if(r)r.textContent=d.rope?'ROPE ATTACHED · RELEASE TO LAUNCH':d.grappleHeld?'SEARCHING FOR NEXT RING':'HOLD ANYWHERE TO AUTO-GRAPPLE';
}
boot();
