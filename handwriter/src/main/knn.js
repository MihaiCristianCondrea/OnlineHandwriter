import { dataUrlToVector } from './preprocess.js';

const featureCache = new Map();

async function getFeatureVector(durl){
  if(!featureCache.has(durl)){
    featureCache.set(durl, await dataUrlToVector(durl));
  }
  return featureCache.get(durl);
}

export function resetCache(){
  featureCache.clear();
}

export async function knnPredict(samples, feat){
  const pairs=[];
  for(const [label, arr] of Object.entries(samples)){
    for(const durl of arr){
      const f = await getFeatureVector(durl);
      let sum=0; for(let i=0;i<f.length;i++){ const d=f[i]-feat[i]; sum+=d*d; }
      pairs.push({label, dist: sum});
    }
  }
  if(!pairs.length) return { label: '', confidence: 0 };
  pairs.sort((a,b)=>a.dist-b.dist);
  const k = Math.min(3, pairs.length);
  const votes={};
  for(let i=0;i<k;i++) votes[pairs[i].label]=(votes[pairs[i].label]||0)+1;
  let best=null, bv=-1;
  for(const [lab,v] of Object.entries(votes)){
    if(v>bv){ best=lab; bv=v; }
  }
  const bestDist = pairs[0].dist;
  const second = pairs[1]?.dist ?? pairs[0].dist;
  const confidence = 1 / (1 + Math.sqrt(bestDist)) * (second > 0 ? Math.min(1, Math.sqrt(second / (bestDist+1e-6))) : 1);
  return { label: best || pairs[0].label, confidence };
}
