const STORAGE_KEY_V2 = 'hw_samples_v2';
const LEGACY_KEY = 'hw_samples';

export function loadSamples(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_V2) || localStorage.getItem(LEGACY_KEY);
    if(!raw) return { samples: {}, skipped: {} };
    const parsed = JSON.parse(raw);
    if(parsed.samples){
      return { samples: parsed.samples || {}, skipped: parsed.skipped || {} };
    }
    return { samples: parsed || {}, skipped: {} };
  }catch(err){
    console.warn('Failed to load samples', err);
    return { samples: {}, skipped: {} };
  }
}

export function saveSamples(samples, skipped){
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ samples, skipped: skipped || {} }));
}
