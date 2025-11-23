import { dataUrlToVector } from './preprocess.js';
import { loadVector, saveVector } from './storage.js';

const featureCache = new Map();

async function getFeatureVector(sample){
  if(sample.vec) return sample.vec;
  if(featureCache.has(sample.durl)) return featureCache.get(sample.durl);
  const promise = loadVector(sample.durl)
    .catch(()=>null)
    .then(stored => {
      if(stored){ sample.vec = stored; return stored; }
      return dataUrlToVector(sample.durl).then(vec => {
        sample.vec = vec;
        saveVector(sample.durl, vec).catch(()=>{});
        return vec;
      });
    });
  featureCache.set(sample.durl, promise);
  return promise;
}

export function resetCache(){
  featureCache.clear();
}

export async function knnPredict(featVec, samples, k = 3){
  const pairs=[];
  for(const [label, arr] of Object.entries(samples)){
    for(const sample of arr){
      const f = await getFeatureVector(sample);
      let dist=0; for(let i=0;i<f.length;i++){ const d=f[i]-featVec[i]; dist+=d*d; }
      pairs.push({label, dist});
    }
  }
  if(!pairs.length) return { label: '', confidence: 0 };

  pairs.sort((a,b)=>a.dist-b.dist);
  const kk = Math.min(k, pairs.length);
  const votes = new Map();
  for(let i=0;i<kk;i++){
    votes.set(pairs[i].label, (votes.get(pairs[i].label)||0)+1);
  }
  let bestLabel = pairs[0].label; let bestVotes = 0;
  for(const [lab, v] of votes){
    if(v > bestVotes){ bestVotes = v; bestLabel = lab; }
  }
  return { label: bestLabel, confidence: bestVotes/kk };
}
