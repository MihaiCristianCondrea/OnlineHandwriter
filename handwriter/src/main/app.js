
// app.js - Handwriter web (prototype)
const CHARSET = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(''),
  'ă','â','î','ș','ț','Ă','Â','Î','Ș','Ț',
  ...'0123456789'.split(''),
  '.',',',';',':','?','!','-','_','(',')','[',']','{','}','/','\\','@','#','$','%','^','&','*','+','=','<','>','~','`','"',"'",'«','»','“','”','…','—','·',
  '⎵','↵'
];

function loadSamples(){
  try{
    const raw = localStorage.getItem('hw_samples');
    if(!raw) return {};
    return JSON.parse(raw);
  }catch(e){ return {}; }
}
function saveSamples(obj){
  localStorage.setItem('hw_samples', JSON.stringify(obj));
}
function dataUrlToImage(src){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = ()=>rej(new Error('load fail'));
    img.src = src;
  });
}
const btnStart = document.getElementById('btn-start-calib');
const btnScan = document.getElementById('btn-scan');
const btnView = document.getElementById('btn-view-samples');
const btnClear = document.getElementById('btn-clear-samples');
const sectCalib = document.getElementById('calib');
const sectScan = document.getElementById('scan');
const sectExport = document.getElementById('export');
const sectWelcome = document.getElementById('welcome');
const sectSamples = document.getElementById('samples-list');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const btnCapture = document.getElementById('btn-capture');
const btnNext = document.getElementById('btn-next-char');
const btnDone = document.getElementById('btn-done-calib');
const calibInfo = document.getElementById('calib-info');
const calibSamplesDiv = document.getElementById('calib-samples');
const videoScan = document.getElementById('video-scan');
const canvasScan = document.getElementById('canvas-scan');
const btnCaptureScan = document.getElementById('btn-capture-scan');
const scanResult = document.getElementById('scan-result');
const finalText = document.getElementById('final-text');
const btnExportDocx = document.getElementById('btn-export-docx');
const btnCopy = document.getElementById('btn-copy');
const samplesGrid = document.getElementById('samples-grid');
const btnBack = document.getElementById('btn-back');
let samples = loadSamples();
let calibIndex = 0;
const PER_CHAR = 3;
let stream=null;
async function startCamera(el){
  if(stream) return;
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
    el.srcObject = stream;
    await el.play();
  }catch(e){
    alert('Permite acces camera in Safari/Settings si reincearca. '+e);
  }
}
function stopCamera(){
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
}
function showSection(s){
  sectWelcome.classList.add('hidden');
  sectCalib.classList.add('hidden');
  sectScan.classList.add('hidden');
  sectExport.classList.add('hidden');
  sectSamples.classList.add('hidden');
  s.classList.remove('hidden');
}
btnStart.onclick = async ()=>{
  calibIndex = 0;
  await startCamera(video);
  updateCalibUI();
  showSection(sectCalib);
};
btnView.onclick = ()=>{
  renderSamplesList();
  showSection(sectSamples);
};
btnBack.onclick = ()=> showSection(sectWelcome);
btnClear.onclick = ()=>{
  if(confirm('Ștergi toate mostrele salvate?')){
    samples = {}; saveSamples(samples);
    alert('Mostre șterse');
  }
};
function updateCalibUI(){
  const ch = CHARSET[calibIndex];
  calibInfo.innerHTML = `<p>Caracter ${calibIndex+1} / ${CHARSET.length}: <b>${ch}</b> — mostre existente: ${ (samples[ch]||[]).length } / ${PER_CHAR}</p>`;
  renderCalibSamples();
}
function renderCalibSamples(){
  calibSamplesDiv.innerHTML = '';
  const ch = CHARSET[calibIndex];
  const arr = samples[ch] || [];
  arr.forEach(durl=>{
    const img = document.createElement('img'); img.src = durl; calibSamplesDiv.appendChild(img);
  });
}
btnCapture.onclick = async ()=>{
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const s = Math.min(canvas.width, canvas.height);
  const sx = (canvas.width - s)/2, sy = (canvas.height - s)/2;
  const imageData = ctx.getImageData(sx,sy,s,s);
  const tmp = document.createElement('canvas'); tmp.width=128; tmp.height=128;
  tmp.getContext('2d').putImageData(imageData,0,0);
  const durl = tmp.toDataURL('image/png');
  const ch = CHARSET[calibIndex];
  samples[ch] = samples[ch] || [];
  if(samples[ch].length >= PER_CHAR){
    alert('Ai deja 3 mostre pentru acest caracter. Apasă "Sări la următorul" sau "Gata".');
    return;
  }
  samples[ch].push(durl);
  saveSamples(samples);
  updateCalibUI();
};
btnNext.onclick = ()=>{
  calibIndex = Math.min(CHARSET.length-1, calibIndex+1);
  updateCalibUI();
};
btnDone.onclick = ()=>{
  stopCamera();
  alert('Calibrare salvată local. Poți continua cu Scan.');
  showSection(sectWelcome);
};
function renderSamplesList(){
  samplesGrid.innerHTML='';
  for(const k of Object.keys(samples)){
    const arr = samples[k];
    if(!arr.length) continue;
    const box = document.createElement('div');
    const h = document.createElement('div'); h.textContent = k; h.style.fontWeight='bold'; box.appendChild(h);
    arr.forEach(durl=>{ const img=document.createElement('img'); img.src=durl; box.appendChild(img); });
    samplesGrid.appendChild(box);
  }
}
async function dataUrlToVector(durl){
  const img = await dataUrlToImage(durl);
  const c = document.createElement('canvas'); c.width=28; c.height=28;
  const ctx = c.getContext('2d');
  ctx.drawImage(img,0,0,28,28);
  const id = ctx.getImageData(0,0,28,28).data;
  const out = new Float32Array(28*28);
  for(let i=0, j=0;i<id.length;i+=4,j++){ const r=id[i],g=id[i+1],b=id[i+2]; const gray=(0.299*r+0.587*g+0.114*b)/255; out[j]=1.0-gray; }
  return Array.from(out);
}
async function knnPredict(feat){
  const pairs=[];
  for(const [k,arr] of Object.entries(samples)){
    for(const durl of arr){
      const f = await dataUrlToVector(durl);
      let sum=0; for(let i=0;i<f.length;i++){ const d=f[i]-feat[i]; sum+=d*d; }
      pairs.push({label:k,dist:sum});
    }
  }
  if(!pairs.length) return '';
  pairs.sort((a,b)=>a.dist-b.dist);
  const k= Math.min(3,pairs.length);
  const votes={};
  for(let i=0;i<k;i++){ votes[pairs[i].label]=(votes[pairs[i].label]||0)+1; }
  let best=null, bv=-1;
  for(const [lab,v] of Object.entries(votes)){ if(v>bv){best=lab;bv=v;} }
  return best||pairs[0].label;
}
btnScan.onclick = async ()=>{
  await startCamera(videoScan);
  showSection(sectScan);
};
btnCaptureScan.onclick = async ()=>{
  canvasScan.width = videoScan.videoWidth; canvasScan.height = videoScan.videoHeight;
  const ctx = canvasScan.getContext('2d');
  ctx.drawImage(videoScan,0,0,canvasScan.width,canvasScan.height);
  const scale = 800 / Math.max(canvasScan.width, canvasScan.height);
  const w = Math.round(canvasScan.width*scale), h = Math.round(canvasScan.height*scale);
  const tmp = document.createElement('canvas'); tmp.width=w; tmp.height=h;
  tmp.getContext('2d').drawImage(canvasScan,0,0,canvasScan.width,canvasScan.height,0,0,w,h);
  const id = tmp.getContext('2d').getImageData(0,0,w,h);
  const data = id.data;
  const gray = new Uint8ClampedArray(w*h);
  for(let i=0,j=0;i<data.length;i+=4,j++){ const r=data[i],g=data[i+1],b=data[i+2]; const v=(0.299*r+0.587*g+0.114*b); gray[j]=v; }
  let sum=0; for(let i=0;i<gray.length;i++) sum+=gray[i]; const thr = sum/gray.length * 0.9;
  const bin = new Uint8ClampedArray(w*h);
  for(let i=0;i<gray.length;i++) bin[i] = gray[i] < thr ? 1 : 0;
  const colSum = new Int32Array(w);
  for(let x=0;x<w;x++){ let s=0; for(let y=0;y<h;y++){ s += bin[y*w + x]; } colSum[x]=s; }
  const gaps = []; let inBlock=false, start=0;
  for(let x=0;x<w;x++){
    const isInk = colSum[x] > Math.max(2, h*0.01);
    if(isInk && !inBlock){ inBlock=true; start=x; }
    if(!isInk && inBlock){ inBlock=false; gaps.push([start,x-1]); }
  }
  if(inBlock) gaps.push([start,w-1]);
  const estimatedChars = [];
  for(const [sx,ex] of gaps){
    const bw = ex - sx + 1;
    const N = Math.max(1, Math.round(bw / 18));
    for(let i=0;i<N;i++){
      const csx = Math.floor(sx + i*bw/N), cex = Math.floor(sx + (i+1)*bw/N);
      const ctmp = document.createElement('canvas'); ctmp.width = cex - csx + 1; ctmp.height = h;
      const ctx2 = ctmp.getContext('2d');
      ctx2.putImageData(tmp.getContext('2d').getImageData(csx,0,ctmp.width,h),0,0);
      const durl = ctmp.toDataURL('image/png');
      const feat = await dataUrlToVector(durl);
      const pred = await knnPredict(feat);
      estimatedChars.push(pred || '?');
    }
    estimatedChars.push(' ');
  }
  const text = estimatedChars.join('').replace(/\s+/g,' ').trim();
  scanResult.innerText = text;
  finalText.value = text;
  stopCamera();
  showSection(sectExport);
};
btnExportDocx.onclick = ()=>{
  const txt = finalText.value;
  const blob = new Blob([txt], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'handwritten_to_word.docx'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  alert('Fișier descărcat (format text simplu în container .docx). Deschide-l cu Word sau Pages.');
};
btnCopy.onclick = ()=>{ navigator.clipboard.writeText(finalText.value).then(()=>alert('Copiat în clipboard')); };
showSection(sectWelcome);
