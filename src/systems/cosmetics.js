const shopSkins = [
  ['color-default','Classic Blue',0x55d9e7,0],
  ['color-red','Red',0xe85b62,90],
  ['color-orange','Orange',0xef8957,100],
  ['color-yellow','Sunshine',0xf2ca67,110],
  ['color-green','Green',0x67bf78,120],
  ['color-mint','Mint',0x8bd8b4,130],
  ['color-cyan','Cyan',0x4bc9d8,140],
  ['color-sky','Sky Blue',0x78bde9,150],
  ['color-blue','Royal Blue',0x486bd0,160],
  ['color-navy','Midnight',0x303a67,170],
  ['color-purple','Purple',0x8a67c5,180],
  ['color-lilac','Lilac',0xb99bdc,190],
  ['color-pink','Pink',0xe88bb9,200],
  ['color-rose','Rose',0xd66e91,210],
  ['color-coral','Coral',0xef8b77,220],
  ['color-white','Whiteout',0xe8e9e5,230],
  ['color-black','Charcoal',0x30333e,240],
  ['color-silver','Silver',0x9ba5b2,260],
  ['color-gold','Gold',0xe7b85d,300],
  ['color-copper','Copper',0xb77755,320],
  ['color-lime','Lime',0xb1d35f,330],
  ['color-teal','Teal',0x368f91,350],
  ['color-indigo','Indigo',0x5055a0,370],
  ['color-magenta','Magenta',0xd94b9a,390],
  ['color-rainbow','Rainbow',0xffffff,600],
  ['color-glacier','Glacier',0x9ddde1,420],
  ['color-lava','Lava',0xe95c42,450],
  ['color-candy','Candy',0xf2a6bb,480],
  ['color-forest','Forest',0x447b5a,500],
  ['color-neon','Neon',0xc3ed4f,550]
].map(([id,name,color,price],index)=>({
  id,type:'color',name,color,price,rarity:price>=500?'EPIC':price>=300?'RARE':'COMMON'
}));

const milestoneSkins = [
  ['skin-rooftop','Rooftop',0xe4a36e,10],
  ['skin-nightfall','Nightfall',0x565b8d,20],
  ['skin-arcade','Arcade',0xd9669c,30],
  ['skin-sunrise','Sunrise',0xf09a70,40],
  ['skin-deepsea','Deep Sea',0x356d9c,50],
  ['skin-electric','Electric',0x8bcfdf,60],
  ['skin-stardust','Stardust',0x9d83c8,70],
  ['skin-inferno','Inferno',0xd84d43,80],
  ['skin-aurora','Aurora',0x65bda5,90],
  ['skin-goldhour','Golden Hour',0xe9bd68,100],
  ['skin-nightshift','Night Shift',0x8188a8,0]
].map(([id,name,color,unlockLevel],index)=>({
  id,type:'color',name,color,price:0,unlockLevel:unlockLevel||undefined,
  rarity:'MILESTONE',dailyOnly:id==='skin-nightshift'
}));

export const ITEMS=[...shopSkins,...milestoneSkins];
