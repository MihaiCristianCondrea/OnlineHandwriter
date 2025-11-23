import { CONFIG } from '../domain/config.js';

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
  btnInstall: document.getElementById('btn-install'),
  btnCapture: document.getElementById('btn-capture'),
  btnNext: document.getElementById('btn-next-char'),
  btnNextUntrained: document.getElementById('btn-next-untrained'),
  btnSkip: document.getElementById('btn-skip-char'),
  btnUseQuick: document.getElementById('btn-use-quick'),
  btnUseFull: document.getElementById('btn-use-full'),
  btnDone: document.getElementById('btn-done-calib'),
  btnCaptureScan: document.getElementById('btn-capture-scan'),
  btnRetake: document.getElementById('btn-retake'),
  btnRotateLeft: document.getElementById('btn-rotate-left'),
  btnRotateRight: document.getElementById('btn-rotate-right'),
  btnProcessScan: document.getElementById('btn-process-scan'),
  btnCancelEdit: document.getElementById('btn-cancel-edit'),
  btnExportTxt: document.getElementById('btn-export-txt'),
  btnExportMd: document.getElementById('btn-export-md'),
  btnCopy: document.getElementById('btn-copy'),
  video: document.getElementById('video'),
  videoScan: document.getElementById('video-scan'),
  canvas: document.getElementById('canvas'),
  canvasScan: document.getElementById('canvas-scan'),
  scanLive: document.getElementById('scan-live'),
  scanPreview: document.getElementById('scan-preview'),
  calibInfo: document.getElementById('calib-info'),
  calibSamples: document.getElementById('calib-samples'),
  calibProgress: document.getElementById('calib-progress-bar'),
  calibProgressText: document.getElementById('calib-progress-text'),
  samplesGrid: document.getElementById('samples-grid'),
  scanResult: document.getElementById('scan-result'),
  finalText: document.getElementById('final-text'),
  sampleFeedback: document.getElementById('sample-feedback'),
  sampleThumb: document.getElementById('sample-thumb'),
  sampleQuality: document.getElementById('sample-quality'),
  sampleWarnings: document.getElementById('sample-warnings'),
  installHint: document.getElementById('install-hint'),
  scanEdit: document.getElementById('scan-edit'),
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
  const ch = state.activeCharset[state.calibIndex];
  const count = (state.samples[ch] || []).length;
  const skipped = state.skipped[ch];
  const tag = skipped ? ' (marcat ca nefolosit)' : (count === 0 ? ' (neantrenat)' : '');
  elements.calibInfo.textContent = `Caracter ${state.calibIndex+1}/${state.activeCharset.length}: ${ch}${tag} — mostre: ${count}/${CONFIG.calib.perChar}`;
  const trained = state.activeCharset.filter(c => (state.samples[c]||[]).length >= CONFIG.calib.perChar || state.skipped[c]).length;
  const pct = Math.round((trained/state.activeCharset.length)*100);
  elements.calibProgress.style.width = `${pct}%`;
  elements.calibProgressText.textContent = `${pct}% complet pentru setul curent (${trained}/${state.activeCharset.length})`;
  elements.calibSamples.textContent = '';
  const arr = state.samples[ch] || [];
  arr.forEach(durl => {
    const img = document.createElement('img');
    img.src = durl.durl || durl;
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
      img.src = durl.durl || durl;
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
  elements.installHint.classList.toggle('hidden', !state.installPrompt);
}
