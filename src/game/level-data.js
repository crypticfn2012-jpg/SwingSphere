const make=(name,difficulty,seed,targets,platforms,obstacles,par)=>({name,difficulty,seed,targets,platforms,obstacles,par});
const BASE_LEVELS=[
make('First Swing','EASY',1,[[0,5,0],[0,7,-17],[7,8,-34]],[[0,0,0,13,1,13],[0,0,-18,9,1,8],[8,1,-38,12,1,10],[8,0,-49,14,1,12]],[],34),
make('Momentum','EASY',2,[[0,7,-2],[7,10,-22],[-4,12,-42],[2,10,-62]],[[0,0,0,12,1,12],[5,2,-24,8,1,8],[-5,4,-46,8,1,8],[2,2,-70,12,1,12]],[[1,3,-35,2]],52),
make('Moving Targets','EASY',3,[[0,7,-3],[8,9,-23],[-7,11,-44],[0,9,-66]],[[0,0,0,12,1,12],[8,2,-26,7,1,7],[-8,4,-49,7,1,7],[0,2,-74,13,1,12]],[[0,4,-35,3]],68),
make('The Heights','MEDIUM',4,[[0,9,-4],[9,14,-25],[-8,19,-48],[2,23,-72]],[[0,0,0,12,1,12],[9,6,-29,8,1,8],[-8,11,-53,8,1,8],[2,16,-79,12,1,12]],[[0,8,-40,4]],88),
make('Speed Run','MEDIUM',5,[[0,7,-3],[8,8,-21],[0,7,-43],[-9,8,-65],[0,9,-87]],[[0,0,0,12,1,12],[8,1,-24,7,1,7],[0,0,-48,7,1,7],[-9,1,-71,7,1,7],[0,1,-95,13,1,13]],[],100),
make('The Gauntlet','MEDIUM',6,[[0,8,-3],[8,10,-24],[-8,12,-47],[8,14,-70],[0,12,-93]],[[0,0,0,12,1,12],[8,3,-28,7,1,7],[-8,5,-52,7,1,7],[8,7,-76,7,1,7],[0,5,-102,13,1,13]],[[0,3,-39,3],[0,5,-64,3],[0,7,-88,3]],112),
make('Precision','HARD',7,[[0,8,-3],[8,10,-23],[-8,12,-43],[7,14,-64],[-1,12,-85]],[[0,0,0,10,1,10],[8,4,-26,5,1,5],[-8,7,-47,5,1,5],[7,9,-68,5,1,5],[-1,7,-92,9,1,9]],[[0,5,-35,2],[0,8,-58,2],[0,9,-79,2]],125),
make('Skyfall','HARD',8,[[0,12,-3],[10,18,-27],[-10,24,-54],[4,28,-83]],[[0,0,0,13,1,13],[10,8,-31,7,1,7],[-10,15,-59,7,1,7],[4,20,-91,12,1,12]],[[0,10,-43,3],[0,17,-74,3]],145),
make('No Mistakes','VERY HARD',9,[[0,9,-3],[9,13,-22],[-9,17,-43],[9,21,-64],[-2,18,-88]],[[0,0,0,11,1,11],[9,5,-25,6,1,6],[-9,9,-47,6,1,6],[9,13,-69,6,1,6],[-2,10,-95,10,1,10]],[[0,5,-35,3],[0,12,-57,3],[0,15,-81,3]],160),
make('The Final Swing','EXPERT',10,[[0,10,-3],[10,16,-23],[-10,22,-47],[10,27,-72],[-2,23,-100],[0,19,-126]],[[0,0,0,12,1,12],[10,7,-27,7,1,7],[-10,13,-52,7,1,7],[10,18,-78,7,1,7],[-2,14,-106,7,1,7],[0,10,-135,14,1,14]],[[0,9,-39,3],[0,16,-64,3],[0,20,-91,3],[0,17,-118,3]],190)
];

const DISTRICTS = [
  'The Suburbs','Downtown','Old Town','Neon Mile','The Heights',
  'Harbour','Midnight City','Skyline','Cloud District','The Summit'
];

// The first ten routes are hand-authored. Later districts remix those routes with
// small, deterministic layout changes so the campaign grows without random unfair jumps.
export const LEVELS = Array.from({length:100},(_,index)=>{
  if(index<BASE_LEVELS.length)return BASE_LEVELS[index];
  const chapter=Math.floor(index/10);
  const template=BASE_LEVELS[index%BASE_LEVELS.length];
  const stretch=1;
  const lift=(chapter%3)*.12;
  const platforms=template.platforms.map((p,j)=>{
    const q=[...p];
    q[1]+=j===0?0:Math.sin((index+1)*.73+j*1.9)*lift;
    q[2]*=stretch;
    q[5]=p[5];
    return q;
  });
  const targets=template.targets.map((p,j)=>{
    const q=[...p];
    q[1]+=Math.cos((index+2)*.41+j*1.2)*lift*.75;
    q[2]*=stretch;
    return q;
  });
  const obstacles=template.obstacles.map((p,j)=>{
    const q=[...p];
    q[2]*=stretch;
    q[3]=p[3];
    return q;
  });
  const difficulty=chapter<2?'EASY':chapter<4?'MEDIUM':chapter<7?'HARD':'EXPERT';
  const district=DISTRICTS[chapter];
  return make(district+' · Route '+String(index+1).padStart(2,'0'),difficulty,index+1,targets,platforms,obstacles,Math.round(template.par*(1+chapter*.055)));
});
