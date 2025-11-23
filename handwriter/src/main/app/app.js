import { CHARSET, QUICK_CHARSET, CONFIG } from '../domain/config.js';
import { loadSamples, saveSamples, saveVector, clearVectors } from '../services/storage.js';
import { startCamera, stopCamera } from '../services/camera.js';
import { captureSquare, dataUrlToVector, captureFullFrame, binarizeImage, evaluateQuality, dataUrlToImage, segmentCharacters } from '../domain/preprocess.js';
import { knnPredict, resetCache } from '../domain/knn.js';
import { elements, render } from '../features/ui.js';

const loaded = loadSamples();

const State = {
  mode: 'WELCOME',
  calibIndex: 0,
  samples: loaded.samples,
  skipped: loaded.skipped,
  activeCharset: [...QUICK_CHARSET],
  stream: null,
  recognizedText: '',
  latestSample: null,
  scanPreview: null,
  installPrompt: null,
};

function setState(patch){
  Object.assign(State, patch);
  render(State);
  renderSampleFeedback();
  renderScanPreview();
}

async function ensureCamera(videoEl){
  try{
    const stream = await startCamera(videoEl, State.stream);
    setState({ stream });
  }catch(err){
    alert('Permite acces la camera și reîncearcă. ' + err);
  }
}

function stopCurrentStream(){
  if(State.stream){
    stopCamera(State.stream);
    setState({ stream: null });
  }
}

function currentChar(){
  return State.activeCharset[State.calibIndex] || State.activeCharset[0];
}

function getNextUntrainedIndex(){
  return State.activeCharset.findIndex(ch => {
    const count = (State.samples[ch] || []).length;
    return (!State.skipped[ch]) && count < CONFIG.calib.perChar;
  });
}

function handleSkipChar(){
  const ch = currentChar();
  const skipped = { ...State.skipped, [ch]: true };
  setState({ skipped });
  persistSamples(State.samples, skipped);
  moveNextChar();
}

function moveNextChar(){
  const next = Math.min(State.activeCharset.length-1, State.calibIndex + 1);
  setState({ calibIndex: next });
}

function handleNextUntrained(){
  const idx = getNextUntrainedIndex();
  if(idx === -1){
    alert('Ai parcurs toate caracterele din setul curent.');
    return;
  }
  setState({ calibIndex: idx });
}

async function handleCaptureSample(){
  const ch = currentChar();
  if(State.skipped[ch]){
    alert('Simbol marcat ca nefolosit. Scoate marcajul sau mergi mai departe.');
    return;
  }
  const existing = State.samples[ch] || [];
  if(existing.length >= CONFIG.calib.perChar){
    alert('Ai deja suficiente mostre pentru acest caracter.');
    return;
  }
  const durl = captureSquare(elements.video);
  const vec = await dataUrlToVector(durl);
  try{
    await saveVector(durl, vec);
  }catch(err){
    console.warn('Nu am putut salva vectorul în IndexedDB', err);
  }
  const quality = await evaluateQuality(durl);
  const sample = { durl, vec };
  const updated = { ...State.samples, [ch]: [...existing, sample] };
  persistSamples(updated, State.skipped);
  setState({ samples: updated, latestSample: { ch, durl, quality } });
}

function persistSamples(samples, skipped){
  saveSamples(samples, skipped);
}

function handleNextChar(){
  moveNextChar();
}

function handleDoneCalib(){
  stopCurrentStream();
  alert('Calibrare salvată local. Poți continua cu Scan.');
  setState({ mode: 'WELCOME' });
}

async function handleClearSamples(){
  if(confirm('Ștergi toate mostrele salvate?')){
    resetCache();
    try{ await clearVectors(); }catch(err){ console.warn('Nu am curățat IndexedDB', err); }
    persistSamples({}, {});
    setState({ samples: {}, skipped: {}, latestSample: null });
    alert('Mostre șterse');
  }
}

async function recognizeChars(chars){
  const outputs=[]; const low=[];
  for(const durl of chars){
    if(durl === ' '){ outputs.push(' '); continue; }
    const feat = await dataUrlToVector(durl);
    const pred = await knnPredict(feat, State.samples);
    const label = pred.label || '?';
    const best = pred.confidence >= 0.6 ? label : '?';
    outputs.push(best);
    const hasTraining = (State.samples[label] || []).length > 0;
    if(!pred.label || pred.confidence < 0.6 || !hasTraining){
      low.push(label || '?');
    }
  }
  return { text: outputs.join('').replace(/\s+/g,' ').trim(), lowConfidence: low };
}

async function handleScanCapture(){
  const frameUrl = captureFullFrame(elements.videoScan);
  stopCurrentStream();
  elements.scanLive.classList.add('hidden');
  setState({
    scanPreview: {
      imageUrl: frameUrl,
      crop: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
      scale: 1,
      imgWidth: 0,
      imgHeight: 0,
    }
  });
  elements.scanPreview.classList.remove('hidden');
  elements.scanEdit.classList.remove('hidden');
  elements.btnRetake.classList.remove('hidden');
}

async function processScanPreview(){
  if(!State.scanPreview){ return; }
  const img = await dataUrlToImage(State.scanPreview.imageUrl);
  const { x, y, w, h } = State.scanPreview.crop;
  const sx = x * img.width;
  const sy = y * img.height;
  const sw = w * img.width;
  const sh = h * img.height;
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const croppedUrl = canvas.toDataURL('image/png');
  const { bin, width, height, canvas: binCanvas } = await binarizeImage(croppedUrl);
  const chars = segmentCharacters(bin, width, height, binCanvas);
  const result = await recognizeChars(chars);
  setState({ recognizedText: result.text, mode: 'EXPORT' });
  if(result.lowConfidence.length){
    const suspect = result.lowConfidence.find(ch => ch && ch !== ' ' && ch !== '?');
    if(suspect){
      autoExpandForChar(suspect);
      alert(`Încredere scăzută pentru caracterul "${suspect}". Hai să îl calibrăm.`);
    }else{
      const nextIdx = getNextUntrainedIndex();
      if(nextIdx >= 0){
        setState({ mode: 'CALIB', calibIndex: nextIdx });
        alert('Am găsit caractere neantrenate. Completează calibrarea.');
      }
    }
  }
}

function autoExpandForChar(ch){
  if(!State.activeCharset.includes(ch)){
    State.activeCharset = [...State.activeCharset, ch];
  }
  setState({
    activeCharset: State.activeCharset,
    calibIndex: State.activeCharset.indexOf(ch),
    mode: 'CALIB'
  });
}

function exportText(ext){
  const txt = elements.finalText.value;
  const blob = new Blob([txt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `handwriter-export.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyToClipboard(){
  navigator.clipboard.writeText(elements.finalText.value)
    .then(()=>alert('Copiat în clipboard'))
    .catch(err=>alert('Nu am putut copia: '+err));
}

function switchCharset(toQuick){
  const target = toQuick ? [...QUICK_CHARSET] : [...CHARSET];
  setState({ activeCharset: target, calibIndex: 0 });
}

function handleRetake(){
  setState({ scanPreview: null });
  elements.scanPreview.classList.add('hidden');
  elements.scanEdit.classList.add('hidden');
  elements.btnRetake.classList.add('hidden');
  elements.scanLive.classList.remove('hidden');
  ensureCamera(elements.videoScan);
}

function handleCancelEdit(){
  setState({ scanPreview: null });
  elements.scanPreview.classList.add('hidden');
  elements.scanEdit.classList.add('hidden');
  elements.btnRetake.classList.add('hidden');
  elements.scanLive.classList.remove('hidden');
  ensureCamera(elements.videoScan);
}

function renderSampleFeedback(){
  if(State.latestSample){
    elements.sampleThumb.src = State.latestSample.durl;
    const { avgBright, inkPct, edgeAvg, warnings } = State.latestSample.quality;
    elements.sampleQuality.textContent = `Luminozitate: ${avgBright} • Cerneală: ${inkPct}% • Claritate: ${edgeAvg}`;
    elements.sampleWarnings.textContent = warnings.join(' · ');
    elements.sampleWarnings.classList.toggle('hidden', warnings.length === 0);
    elements.sampleFeedback.classList.remove('hidden');
  }else{
    elements.sampleFeedback.classList.add('hidden');
  }
}

async function rotatePreview(delta){
  if(!State.scanPreview) return;
  const img = await dataUrlToImage(State.scanPreview.imageUrl);
  const canvas = document.createElement('canvas');
  const rad = delta * Math.PI/180;
  const swap = Math.abs(delta)%180 === 90;
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width/2, -img.height/2);
  const rotatedUrl = canvas.toDataURL('image/png');
  setState({ scanPreview: { ...State.scanPreview, imageUrl: rotatedUrl, crop: { x:0.05, y:0.05, w:0.9, h:0.9 } } });
}

function renderScanPreview(){
  if(!State.scanPreview){ return; }
  const img = new Image();
  img.onload = () => {
    const maxW = 920;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    elements.scanPreview.width = w;
    elements.scanPreview.height = h;
    const ctx = elements.scanPreview.getContext('2d');
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(img,0,0,w,h);
    const { x, y, w: cw, h: ch } = State.scanPreview.crop;
    ctx.strokeStyle = '#0b5cff';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(11,92,255,0.12)';
    ctx.strokeRect(x*w, y*h, cw*w, ch*h);
    ctx.fillRect(x*w, y*h, cw*w, ch*h);
    State.scanPreview.scale = scale;
    State.scanPreview.imgWidth = img.width;
    State.scanPreview.imgHeight = img.height;
  };
  img.src = State.scanPreview.imageUrl;
  elements.scanPreview.classList.remove('hidden');
  elements.scanEdit.classList.remove('hidden');
  elements.btnRetake.classList.remove('hidden');
}

function cropperPos(e){
  const rect = elements.scanPreview.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

function initCropper(){
  let dragging=false; let start=null;
  const startDrag = e => {
    if(!State.scanPreview) return;
    dragging=true;
    start = cropperPos(e);
    State.scanPreview.crop = { ...State.scanPreview.crop, x: start.x, y: start.y, w: 0.1, h: 0.1 };
  };
  const moveDrag = e => {
    if(!dragging || !State.scanPreview) return;
    const pos = cropperPos(e);
    const x0 = Math.min(start.x, pos.x);
    const y0 = Math.min(start.y, pos.y);
    const w = Math.max(0.05, Math.abs(pos.x - start.x));
    const h = Math.max(0.05, Math.abs(pos.y - start.y));
    State.scanPreview.crop = { x: x0, y: y0, w: Math.min(1 - x0, w), h: Math.min(1 - y0, h) };
    renderScanPreview();
  };
  const endDrag = () => { dragging=false; };
  ['mousedown','touchstart'].forEach(evt => elements.scanPreview.addEventListener(evt, ev => {
    const point = ev.touches ? ev.touches[0] : ev;
    startDrag(point);
  }));
  ['mousemove','touchmove'].forEach(evt => elements.scanPreview.addEventListener(evt, ev => {
    const point = ev.touches ? ev.touches[0] : ev;
    moveDrag(point);
  }));
  ['mouseup','mouseleave','touchend'].forEach(evt => elements.scanPreview.addEventListener(evt, endDrag));
}

function initInstallPrompt(){
  window.addEventListener('beforeinstallprompt', (event)=>{
    event.preventDefault();
    setState({ installPrompt: event });
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

function initVisibilityGuards(){
  const halt = () => stopCurrentStream();
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ halt(); }
  });
  window.addEventListener('pagehide', halt);
}

function initListeners(){
  elements.btnStart.addEventListener('click', async ()=>{
    setState({ calibIndex: 0, activeCharset: [...QUICK_CHARSET], mode: 'CALIB' });
    await ensureCamera(elements.video);
  });
  elements.btnScan.addEventListener('click', async ()=>{
    setState({ mode: 'SCAN' });
    elements.scanLive.classList.remove('hidden');
    elements.scanPreview.classList.add('hidden');
    elements.scanEdit.classList.add('hidden');
    elements.btnRetake.classList.add('hidden');
    await ensureCamera(elements.videoScan);
  });
  elements.btnView.addEventListener('click', ()=> setState({ mode: 'SAMPLES' }));
  elements.btnBack.addEventListener('click', ()=> setState({ mode: 'WELCOME' }));
  elements.btnClear.addEventListener('click', handleClearSamples);
  elements.btnCapture.addEventListener('click', handleCaptureSample);
  elements.btnNext.addEventListener('click', handleNextChar);
  elements.btnDone.addEventListener('click', handleDoneCalib);
  elements.btnCaptureScan.addEventListener('click', handleScanCapture);
  elements.btnProcessScan.addEventListener('click', processScanPreview);
  elements.btnCopy.addEventListener('click', copyToClipboard);
  elements.btnExportTxt.addEventListener('click', ()=>exportText('txt'));
  elements.btnExportMd.addEventListener('click', ()=>exportText('md'));
  elements.btnNextUntrained.addEventListener('click', handleNextUntrained);
  elements.btnSkip.addEventListener('click', handleSkipChar);
  elements.btnUseQuick.addEventListener('click', ()=>switchCharset(true));
  elements.btnUseFull.addEventListener('click', ()=>switchCharset(false));
  elements.btnRetake.addEventListener('click', handleRetake);
  elements.btnCancelEdit.addEventListener('click', handleCancelEdit);
  elements.btnRotateLeft.addEventListener('click', ()=>rotatePreview(-90));
  elements.btnRotateRight.addEventListener('click', ()=>rotatePreview(90));
  elements.btnInstall.addEventListener('click', ()=>{
    if(State.installPrompt){
      State.installPrompt.prompt();
      State.installPrompt.userChoice.finally(()=> setState({ installPrompt: null }));
    }
  });
}

function main(){
  initListeners();
  initCropper();
  initInstallPrompt();
  initVisibilityGuards();
  render(State);
}

main();
