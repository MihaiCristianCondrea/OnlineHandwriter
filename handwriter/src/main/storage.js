const STORAGE_KEY = 'hw_samples';

export function loadSamples(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return {};
    return JSON.parse(raw);
  }catch(err){
    console.warn('Failed to load samples', err);
    return {};
  }
}

export function saveSamples(samples){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
}
