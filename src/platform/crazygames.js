const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
export class CrazyGames {
  constructor(){this.sdk=null;this.ready=false;this.active=false;this.environment='disabled';}
  async init(){
    try{
      if(!window.CrazyGames?.SDK){
        await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=SDK_URL;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
      }
      this.sdk=window.CrazyGames.SDK;
      await this.sdk.init();
      this.environment=this.sdk.environment||'disabled';
      this.ready=this.environment!=='disabled';
      return this.ready;
    }catch(error){console.info('[SwingSphere] CrazyGames SDK unavailable; using browser mode.',error);return false;}
  }
  call(path,...args){if(!this.ready)return;try{let obj=this.sdk;for(let i=0;i<path.length-1;i++)obj=obj?.[path[i]];const fn=obj?.[path[path.length-1]];if(typeof fn==='function')return fn.apply(obj,args);}catch(e){console.warn('[SwingSphere] SDK call failed:',path.join('.'),e);}}
  loadingStart(){this.call(['game','loadingStart']);}
  loadingStop(){this.call(['game','loadingStop']);}
  gameplayStart(){if(this.active)return;this.active=true;this.call(['game','gameplayStart']);}
  gameplayStop(){if(!this.active)return;this.active=false;this.call(['game','gameplayStop']);}
  happyTime(){this.call(['game','happytime']);}
  async rewarded(){
    if(!this.ready||!this.sdk.ad?.requestAd)return {ok:false,reason:'unavailable'};
    try{let completed=false;await this.sdk.ad.requestAd('rewarded',{adStarted:()=>{},adFinished:()=>{completed=true;},adError:()=>{completed=false;}});return {ok:completed,reason:completed?'finished':'not-finished'};}
    catch(e){return {ok:false,reason:'error'};}
  }
  async saveCloud(key,value){
    if(!this.ready||!this.sdk.data?.setItem)return false;
    try{await this.sdk.data.setItem(key,JSON.stringify(value));return true;}catch(e){console.warn('Cloud save unavailable',e);return false;}
  }
  async loadCloud(key){
    if(!this.ready||!this.sdk.data?.getItem)return null;
    try{const v=await this.sdk.data.getItem(key);return typeof v==='string'?JSON.parse(v):v;}catch(e){return null;}
  }
  async user(){if(!this.ready||!this.sdk.user?.getUser)return null;try{return await this.sdk.user.getUser();}catch(e){return null;}}
}