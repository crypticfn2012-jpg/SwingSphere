export async function encryptScore(score,key){
  const raw=atob(key);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(bytes.length!==32)throw new Error('CrazyGames leaderboard key must decode to 32 bytes.');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey=await crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt']);
  const plain=new TextEncoder().encode(String(score));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,plain));
  const combined=new Uint8Array(iv.length+encrypted.length);combined.set(iv);combined.set(encrypted,iv.length);
  return btoa(String.fromCharCode(...combined));
}
export class LeaderboardManager{
  constructor(platform){this.platform=platform;this.key=import.meta.env.VITE_CG_LEADERBOARD_ENCRYPTION_KEY||'';}
  async submitTotalStars(score){
    if(!this.platform.ready||!this.platform.sdk?.user?.submitScore||!this.key)return {ok:false,reason:'not-configured'};
    if(!Number.isFinite(score)||score<0)return {ok:false,reason:'invalid-score'};
    try{const encryptedScore=await encryptScore(score,this.key);this.platform.sdk.user.submitScore({encryptedScore,score});return {ok:true};}
    catch(error){console.warn('[SwingSphere] Leaderboard score was not submitted',error);return {ok:false,reason:'error'};}
  }
}