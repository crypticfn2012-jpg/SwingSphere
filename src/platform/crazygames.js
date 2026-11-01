const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
export class CrazyGames {
  constructor(){this.sdk=null;this.ready=false;this.active=false;this.environment='disabled';}
  async init(){
    try{
      if(!window.CrazyGames?.SDK) await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=SDK_URL;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
      this.sdk=window.CrazyGames.SDK;await this.sdk.init();this.environment=this.sdk.environment||'disabled';this.ready=this.environment!=='disabled';return this.ready;
    }catch(error){console.info('[SwingSphere] SDK unavailable; browser mode enabled.',error);return false;}
  }
  call(path,...args){if(!this.ready)return;try{let obj=this.sdk;for(let i=0;i<path.length-1;i++)obj=obj?.[path[i]];const fn=obj?.[path[path.length-1]];if(typeof fn==='function')return fn.apply(obj,args);}catch(e){console.warn('[SwingSphere] SDK call failed:',path.join('.'),e);}}
  loadingStart(){this.call(['game','loadingStart']);}
  loadingStop(){this.call(['game','loadingStop']);}
  gameplayStart(){if(this.active)return;this.active=true;this.call(['game','gameplayStart']);}
  gameplayStop(){if(!this.active)return;this.active=false;this.call(['game','gameplayStop']);}
  happyTime(){this.call(['game','happytime']);}
  rewarded(onStarted=()=>{},onEnded=()=>{}){
    if(!this.ready||typeof this.sdk.ad?.requestAd!=='function'){onEnded(false);return false;}
    let settled=false;const finish=ok=>{if(settled)return;settled=true;onEnded(ok);};
    try{this.sdk.ad.requestAd('rewarded',{adStarted:()=>onStarted(),adFinished:()=>finish(true),adError:error=>{console.warn('[SwingSphere] Rewarded ad unavailable',error);finish(false);}});return true;}
    catch(e){console.warn('[SwingSphere] Rewarded ad request failed',e);finish(false);return false;}
  }
  async saveCloud(key,value){if(!this.ready||!this.sdk.data?.setItem)return false;try{await this.sdk.data.setItem(key,JSON.stringify(value));return true;}catch(e){console.warn('Cloud save unavailable',e);return false;}}
  async loadCloud(key){if(!this.ready||!this.sdk.data?.getItem)return null;try{const v=await this.sdk.data.getItem(key);return typeof v==='string'?JSON.parse(v):v;}catch(e){return null;}}
  async user(){if(!this.ready||!this.sdk.user?.getUser)return null;try{return await this.sdk.user.getUser();}catch(e){return null;}}
}