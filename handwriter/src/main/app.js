import { CHARSET, CONFIG } from './config.js';
import { loadSamples, saveSamples } from './storage.js';
import { startCamera, stopCamera } from './camera.js';
import { captureSquare, captureBinarizedFrame, sliceCharacters, findInkRuns, dataUrlToVector } from './preprocess.js';
import { knnPredict, resetCache } from './knn.js';
import { elements, render } from './ui.js';

const State = {
  mode: 'WELCOME',
  calibIndex: 0,
  samples: loadSamples(),
  stream: null,
  recognizedText: '',
};

function setState(patch){
  Object.assign(State, patch);
  render(State);
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

async function handleCaptureSample(){
  const ch = CHARSET[State.calibIndex];
  const existing = State.samples[ch] || [];
  if(existing.length >= CONFIG.calib.perChar){
    alert('Ai deja suficiente mostre pentru acest caracter.');
    return;
  }
  const durl = captureSquare(elements.video);
  const updated = { ...State.samples, [ch]: [...existing, durl] };
  saveSamples(updated);
  setState({ samples: updated });
}

function handleNextChar(){
  setState({ calibIndex: Math.min(CHARSET.length-1, State.calibIndex + 1) });
}

function handleDoneCalib(){
  stopCurrentStream();
  alert('Calibrare salvată local. Poți continua cu Scan.');
  setState({ mode: 'WELCOME' });
}

function handleClearSamples(){
  if(confirm('Ștergi toate mostrele salvate?')){
    resetCache();
    saveSamples({});
    setState({ samples: {} });
    alert('Mostre șterse');
  }
}

async function recognizeChars(chars){
  const outputs=[];
  for(const durl of chars){
    if(durl === ' '){ outputs.push(' '); continue; }
    const feat = await dataUrlToVector(durl);
    const pred = await knnPredict(State.samples, feat);
    outputs.push(pred || '?');
  }
  return outputs.join('').replace(/\s+/g,' ').trim();
}

async function handleScanCapture(){
  const { bin, width, height, canvas } = captureBinarizedFrame(elements.videoScan);
  const ranges = findInkRuns(bin, width, height);
  const chars = sliceCharacters(ranges, canvas);
  const text = await recognizeChars(chars);
  stopCurrentStream();
  setState({ recognizedText: text, mode: 'EXPORT' });
}

function exportDocx(){
  const txt = elements.finalText.value;
  const blob = new Blob([txt], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'handwritten_to_word.docx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  alert('Fișier descărcat (format text simplu în container .docx). Deschide-l cu Word sau Pages.');
}

function copyToClipboard(){
  navigator.clipboard.writeText(elements.finalText.value)
    .then(()=>alert('Copiat în clipboard'))
    .catch(err=>alert('Nu am putut copia: '+err));
}

function initListeners(){
  elements.btnStart.addEventListener('click', async ()=>{
    setState({ calibIndex: 0, mode: 'CALIB' });
    await ensureCamera(elements.video);
  });
  elements.btnScan.addEventListener('click', async ()=>{
    setState({ mode: 'SCAN' });
    await ensureCamera(elements.videoScan);
  });
  elements.btnView.addEventListener('click', ()=> setState({ mode: 'SAMPLES' }));
  elements.btnBack.addEventListener('click', ()=> setState({ mode: 'WELCOME' }));
  elements.btnClear.addEventListener('click', handleClearSamples);
  elements.btnCapture.addEventListener('click', handleCaptureSample);
  elements.btnNext.addEventListener('click', handleNextChar);
  elements.btnDone.addEventListener('click', handleDoneCalib);
  elements.btnCaptureScan.addEventListener('click', handleScanCapture);
  elements.btnExportDocx.addEventListener('click', exportDocx);
  elements.btnCopy.addEventListener('click', copyToClipboard);
}

function main(){
  initListeners();
  render(State);
}

main();
