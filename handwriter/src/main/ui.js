import { CHARSET, CONFIG } from './config.js';

const sections = {
  WELCOME: document.getElementById('welcome'),
  CALIB: document.getElementById('calib'),
  SCAN: document.getElementById('scan'),
  EXPORT: document.getElementById('export'),
  SAMPLES: document.getElementById('samples-list'),
};

export const elements = {
  btnStart: document.getElementById('btn-start-calib'),
  btnScan: document.getElementById('btn-scan'),
  btnView: document.getElementById('btn-view-samples'),
  btnClear: document.getElementById('btn-clear-samples'),
  btnBack: document.getElementById('btn-back'),
  btnCapture: document.getElementById('btn-capture'),
  btnNext: document.getElementById('btn-next-char'),
  btnDone: document.getElementById('btn-done-calib'),
  btnCaptureScan: document.getElementById('btn-capture-scan'),
  btnExportDocx: document.getElementById('btn-export-docx'),
  btnCopy: document.getElementById('btn-copy'),
  video: document.getElementById('video'),
  videoScan: document.getElementById('video-scan'),
  canvas: document.getElementById('canvas'),
  canvasScan: document.getElementById('canvas-scan'),
  calibInfo: document.getElementById('calib-info'),
  calibSamples: document.getElementById('calib-samples'),
  samplesGrid: document.getElementById('samples-grid'),
  scanResult: document.getElementById('scan-result'),
  finalText: document.getElementById('final-text'),
};

actionSections(Object.values(sections));
function actionSections(list){
  list.forEach(sec => sec.classList.add('hidden'));
}

function showSection(mode){
  Object.values(sections).forEach(sec => sec.classList.add('hidden'));
  const target = sections[mode];
  if(target){ target.classList.remove('hidden'); }
}

function renderCalib(state){
  const ch = CHARSET[state.calibIndex];
  const count = (state.samples[ch] || []).length;
  elements.calibInfo.textContent = `Caracter ${state.calibIndex+1}/${CHARSET.length}: ${ch} — mostre: ${count}/${CONFIG.calib.perChar}`;
  elements.calibSamples.textContent = '';
  const arr = state.samples[ch] || [];
  arr.forEach(durl => {
    const img = document.createElement('img');
    img.src = durl;
    elements.calibSamples.appendChild(img);
  });
}

function renderSamplesList(samples){
  elements.samplesGrid.textContent='';
  for(const [k, arr] of Object.entries(samples)){
    if(!arr.length) continue;
    const box = document.createElement('div');
    const header = document.createElement('div');
    header.textContent = k;
    header.style.fontWeight = 'bold';
    box.appendChild(header);
    arr.forEach(durl => {
      const img = document.createElement('img');
      img.src = durl;
      box.appendChild(img);
    });
    elements.samplesGrid.appendChild(box);
  }
}

export function render(state){
  showSection(state.mode);
  if(state.mode === 'CALIB') renderCalib(state);
  if(state.mode === 'SAMPLES') renderSamplesList(state.samples);
  if(state.mode === 'EXPORT'){
    elements.scanResult.textContent = state.recognizedText;
    elements.finalText.value = state.recognizedText;
  }
}
