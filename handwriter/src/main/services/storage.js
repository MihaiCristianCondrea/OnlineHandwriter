const STORAGE_KEY_V2 = 'hw_samples_v2';
const LEGACY_KEY = 'hw_samples';
const DB_NAME = 'hw_samples_db';
const DB_STORE = 'vectors';

let dbPromise = null;

function getDb(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function normalizeSamples(samples){
  const out = {};
  for(const [label, arr] of Object.entries(samples || {})){
    if(!Array.isArray(arr)) continue;
    out[label] = arr.map(item => {
      if(typeof item === 'string') return { durl: item, vec: null };
      if(item && typeof item === 'object'){
        const durl = item.durl || item.dataUrl || item.url || item.u;
        if(!durl) return null;
        return { durl, vec: item.vec || null };
      }
      return null;
    }).filter(Boolean);
  }
  return out;
}

function stripVectors(samples){
  const out = {};
  for(const [label, arr] of Object.entries(samples || {})){
    out[label] = (arr || []).map(item => ({ durl: item.durl || item }));
  }
  return out;
}

export function loadSamples(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_V2) || localStorage.getItem(LEGACY_KEY);
    if(!raw) return { samples: {}, skipped: {} };
    const parsed = JSON.parse(raw);
    if(parsed.samples){
      return { samples: normalizeSamples(parsed.samples), skipped: parsed.skipped || {} };
    }
    return { samples: normalizeSamples(parsed), skipped: {} };
  }catch(err){
    console.warn('Failed to load samples', err);
    return { samples: {}, skipped: {} };
  }
}

export function saveSamples(samples, skipped){
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ samples: stripVectors(samples), skipped: skipped || {} }));
}

export async function saveVector(durl, vec){
  const db = await getDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(vec, durl);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadVector(durl){
  const db = await getDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(durl);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearVectors(){
  const db = await getDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
