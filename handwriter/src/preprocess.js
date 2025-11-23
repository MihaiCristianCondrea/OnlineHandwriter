import { CONFIG } from './config.js';

export function dataUrlToImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = ()=>reject(new Error('load fail'));
    img.src = src;
  });
}

export async function dataUrlToVector(durl){
  const img = await dataUrlToImage(durl);
  const size = CONFIG.feature.size;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0,size,size);
  const id = ctx.getImageData(0,0,size,size).data;
  const out = new Float32Array(size*size);
  for(let i=0,j=0;i<id.length;i+=4,j++){
    const [r,g,b] = [id[i], id[i+1], id[i+2]];
    const gray = (0.299*r + 0.587*g + 0.114*b)/255;
    out[j] = 1 - gray;
  }
  return Array.from(out);
}

export function captureSquare(video){
  const canvas = document.createElement('canvas');
  canvas.width = CONFIG.calib.squareSize;
  canvas.height = CONFIG.calib.squareSize;
  const ctx = canvas.getContext('2d');
  const side = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - side)/2;
  const sy = (video.videoHeight - side)/2;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, CONFIG.calib.squareSize, CONFIG.calib.squareSize);
  return canvas.toDataURL('image/png');
}

function resizeFrame(video){
  const scale = CONFIG.scan.maxDim / Math.max(video.videoWidth, video.videoHeight);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, w, h);
  return { canvas, width: w, height: h, ctx };
}

function toGrayscale(imageData){
  const { data } = imageData;
  const gray = new Uint8ClampedArray(data.length/4);
  for(let i=0,j=0;i<data.length;i+=4,j++){
    const [r,g,b] = [data[i], data[i+1], data[i+2]];
    gray[j] = (0.299*r + 0.587*g + 0.114*b);
  }
  return gray;
}

export function captureBinarizedFrame(video){
  const { canvas, width, height, ctx } = resizeFrame(video);
  const imageData = ctx.getImageData(0,0,width,height);
  const gray = toGrayscale(imageData);
  let sum=0; for(const v of gray) sum+=v;
  const thr = (sum/gray.length) * CONFIG.scan.avgThrScale;
  const bin = new Uint8ClampedArray(width*height);
  for(let i=0;i<gray.length;i++) bin[i] = gray[i] < thr ? 1 : 0;
  return { bin, width, height, canvas };
}

export function findInkRuns(bin, width, height){
  const colSum = new Int32Array(width);
  for(let x=0;x<width;x++){
    let s=0;
    for(let y=0;y<height;y++) s += bin[y*width + x];
    colSum[x] = s;
  }
  const ranges=[]; let inBlock=false; let start=0;
  for(let x=0;x<width;x++){
    const isInk = colSum[x] > Math.max(CONFIG.scan.minInkCols, height*CONFIG.scan.colInkFrac);
    if(isInk && !inBlock){ inBlock=true; start=x; }
    if(!isInk && inBlock){ inBlock=false; ranges.push([start,x-1]); }
  }
  if(inBlock) ranges.push([start,width-1]);
  return ranges;
}

export function sliceCharacters(ranges, sourceCanvas){
  const chars=[];
  const ctx = sourceCanvas.getContext('2d');
  const h = sourceCanvas.height;
  for(const [sx, ex] of ranges){
    const bw = ex - sx + 1;
    const slots = Math.max(1, Math.round(bw / CONFIG.scan.estCharWidth));
    for(let i=0;i<slots;i++){
      const csx = Math.floor(sx + i*bw/slots);
      const cex = Math.floor(sx + (i+1)*bw/slots);
      const w = cex - csx + 1;
      const cCanvas = document.createElement('canvas');
      cCanvas.width = w;
      cCanvas.height = h;
      const segment = ctx.getImageData(csx, 0, w, h);
      cCanvas.getContext('2d').putImageData(segment, 0, 0);
      chars.push(cCanvas.toDataURL('image/png'));
    }
    chars.push(' ');
  }
  return chars;
}
