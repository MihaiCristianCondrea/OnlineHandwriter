import { CONFIG } from './config.js';

export function dataUrlToImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = ()=>reject(new Error('load fail'));
    img.src = src;
  });
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

function otsuThreshold(gray){
  const hist = new Uint32Array(256);
  for(const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for(let i=0;i<256;i++) sum += i * hist[i];
  let sumB = 0; let wB = 0; let maxVar = -1; let threshold = 0;
  for(let t=0;t<256;t++){
    wB += hist[t];
    if(wB === 0) continue;
    const wF = total - wB;
    if(wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if(between > maxVar){
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

function binarize(gray, thr){
  const bin = new Uint8ClampedArray(gray.length);
  for(let i=0;i<gray.length;i++) bin[i] = gray[i] <= thr ? 1 : 0;
  return bin;
}

function applyErode(bin, width, height){
  const out = new Uint8ClampedArray(bin.length);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      let keep = 1;
      for(let dy=-1; dy<=1 && keep; dy++){
        for(let dx=-1; dx<=1; dx++){
          const nx = x + dx; const ny = y + dy;
          if(nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if(!bin[ny*width + nx]){ keep = 0; break; }
        }
      }
      out[y*width + x] = keep;
    }
  }
  return out;
}

function applyDilate(bin, width, height){
  const out = new Uint8ClampedArray(bin.length);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      let set = 0;
      for(let dy=-1; dy<=1 && !set; dy++){
        for(let dx=-1; dx<=1; dx++){
          const nx = x + dx; const ny = y + dy;
          if(nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if(bin[ny*width + nx]){ set = 1; break; }
        }
      }
      out[y*width + x] = set;
    }
  }
  return out;
}

function applyOpen(bin, width, height){
  const eroded = applyErode(bin, width, height);
  return applyDilate(eroded, width, height);
}

function removeSmallComponents(bin, width, height, minSize){
  if(minSize <= 1) return bin;
  const visited = new Uint8Array(bin.length);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for(let idx=0; idx<bin.length; idx++){
    if(!bin[idx] || visited[idx]) continue;
    const stack = [idx];
    const component = [];
    visited[idx] = 1;
    while(stack.length){
      const cur = stack.pop();
      component.push(cur);
      const x = cur % width;
      const y = Math.floor(cur / width);
      for(const [dx,dy] of dirs){
        const nx = x + dx; const ny = y + dy;
        if(nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny*width + nx;
        if(bin[nIdx] && !visited[nIdx]){
          visited[nIdx] = 1;
          stack.push(nIdx);
        }
      }
    }
    if(component.length < minSize){
      for(const pos of component) bin[pos] = 0;
    }
  }
  return bin;
}

function findBoundingBox(bin, width, height){
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      if(bin[y*width + x]){
        if(x < minX) minX = x;
        if(y < minY) minY = y;
        if(x > maxX) maxX = x;
        if(y > maxY) maxY = y;
      }
    }
  }
  if(maxX === -1) return null;
  return { minX, minY, maxX, maxY };
}

function cropBinary(bin, width, height, bbox, padding){
  const minX = Math.max(0, bbox.minX - padding);
  const minY = Math.max(0, bbox.minY - padding);
  const maxX = Math.min(width - 1, bbox.maxX + padding);
  const maxY = Math.min(height - 1, bbox.maxY + padding);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Uint8ClampedArray(w*h);
  for(let y=minY;y<=maxY;y++){
    for(let x=minX;x<=maxX;x++){
      out[(y - minY)*w + (x - minX)] = bin[y*width + x];
    }
  }
  return { bin: out, width: w, height: h };
}

function binaryToCanvas(bin, width, height){
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  for(let i=0;i<bin.length;i++){
    const val = bin[i] ? 0 : 255;
    imageData.data[i*4] = val;
    imageData.data[i*4+1] = val;
    imageData.data[i*4+2] = val;
    imageData.data[i*4+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function cleanBinary(bin, width, height, minComponentArea, doOpen){
  const cleaned = removeSmallComponents(bin, width, height, minComponentArea);
  if(doOpen){
    return applyOpen(cleaned, width, height);
  }
  return cleaned;
}

function resizeFrame(video){
  const scale = Math.min(1, CONFIG.scan.maxDim / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, w, h);
  return { canvas, width: w, height: h, ctx };
}

function resizeImage(img){
  const scale = Math.min(1, CONFIG.scan.maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, width: w, height: h, ctx };
}

function grayscaleAndBinary(ctx, width, height, minComponentArea, doOpen){
  const imageData = ctx.getImageData(0,0,width,height);
  const gray = toGrayscale(imageData);
  const thr = otsuThreshold(gray);
  const bin = binarize(gray, thr);
  const cleaned = cleanBinary(bin, width, height, minComponentArea, doOpen);
  return { bin: cleaned, width, height };
}

export async function dataUrlToVector(durl){
  const img = await dataUrlToImage(durl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { bin, width, height } = grayscaleAndBinary(
    ctx,
    canvas.width,
    canvas.height,
    CONFIG.feature.minComponentArea,
    CONFIG.feature.morphology.open
  );
  const bbox = findBoundingBox(bin, width, height);
  if(!bbox){
    return new Array(CONFIG.feature.size * CONFIG.feature.size).fill(0);
  }
  const cropped = cropBinary(bin, width, height, bbox, CONFIG.feature.padding);
  const binCanvas = binaryToCanvas(cropped.bin, cropped.width, cropped.height);
  const target = document.createElement('canvas');
  target.width = CONFIG.feature.size;
  target.height = CONFIG.feature.size;
  const tctx = target.getContext('2d');
  tctx.drawImage(binCanvas, 0, 0, target.width, target.height);
  const id = tctx.getImageData(0,0,target.width,target.height).data;
  const out = new Float32Array(target.width*target.height);
  for(let i=0,j=0;i<id.length;i+=4,j++){
    const gray = id[i];
    out[j] = 1 - (gray/255);
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

export function captureFullFrame(video){
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function captureBinarizedFrame(video){
  const { canvas, width, height, ctx } = resizeFrame(video);
  const { bin } = grayscaleAndBinary(ctx, width, height, CONFIG.scan.minComponentArea, CONFIG.scan.morphology.open);
  const binCanvas = binaryToCanvas(bin, width, height);
  return { bin, width, height, canvas: binCanvas };
}

export async function binarizeImage(dataUrl){
  const img = await dataUrlToImage(dataUrl);
  const { canvas, width, height, ctx } = resizeImage(img);
  const { bin } = grayscaleAndBinary(ctx, width, height, CONFIG.scan.minComponentArea, CONFIG.scan.morphology.open);
  const binCanvas = binaryToCanvas(bin, width, height);
  return { bin, width, height, canvas: binCanvas };
}

function findLineRanges(bin, width, height){
  const rowSum = new Int32Array(height);
  for(let y=0;y<height;y++){
    let s=0; for(let x=0;x<width;x++) s += bin[y*width + x];
    rowSum[y] = s;
  }
  const thr = Math.max(CONFIG.scan.minInkRows, Math.floor(width * CONFIG.scan.rowInkFrac));
  const ranges=[]; let inRun=false; let start=0;
  for(let y=0;y<height;y++){
    const hasInk = rowSum[y] > thr;
    if(hasInk && !inRun){ inRun=true; start=y; }
    if(!hasInk && inRun){ ranges.push([start, y-1]); inRun=false; }
  }
  if(inRun) ranges.push([start, height-1]);
  return ranges;
}

function columnRunsForLine(bin, width, yStart, yEnd){
  const colSum = new Int32Array(width);
  for(let x=0;x<width;x++){
    let s=0; for(let y=yStart;y<=yEnd;y++) s += bin[y*width + x];
    colSum[x] = s;
  }
  const thr = Math.max(CONFIG.scan.minInkCols, Math.floor((yEnd - yStart + 1) * CONFIG.scan.colInkFrac));
  const ranges=[]; let inRun=false; let start=0;
  for(let x=0;x<width;x++){
    const hasInk = colSum[x] > thr;
    if(hasInk && !inRun){ inRun=true; start=x; }
    if(!hasInk && inRun){ ranges.push([start, x-1, colSum]); inRun=false; }
  }
  if(inRun) ranges.push([start, width-1, colSum]);
  return ranges;
}

function splitByMinima(range, colSum){
  const [sx, ex] = range;
  const segment = colSum.slice(sx, ex+1);
  const maxVal = Math.max(...segment);
  const cutLevel = Math.max(1, Math.floor(maxVal * CONFIG.scan.minimaDrop));
  const minima=[];
  for(let i=sx+1;i<ex;i++){
    const val = colSum[i];
    if(val < cutLevel && val <= colSum[i-1] && val <= colSum[i+1]){
      minima.push(i);
    }
  }
  if(!minima.length) return [[sx, ex]];
  const ranges=[];
  let prev = sx;
  for(const m of minima){
    if(m - prev + 1 >= CONFIG.scan.minCharWidth){
      ranges.push([prev, m-1]);
      prev = m+1;
    }
  }
  if(ex - prev + 1 >= CONFIG.scan.minCharWidth || !ranges.length){
    ranges.push([prev, ex]);
  }
  return ranges;
}

export function segmentCharacters(bin, width, height, sourceCanvas){
  const ctx = sourceCanvas.getContext('2d');
  const lines = findLineRanges(bin, width, height);
  const chars=[];
  for(const [sy, ey] of lines){
    const colRanges = columnRunsForLine(bin, width, sy, ey);
    for(const [sx, ex, colSum] of colRanges){
      const parts = splitByMinima([sx, ex], colSum);
      for(const [csx, cex] of parts){
        const cw = cex - csx + 1;
        const ch = ey - sy + 1;
        if(cw < CONFIG.scan.minCharWidth || ch < CONFIG.scan.minInkRows) continue;
        const cCanvas = document.createElement('canvas');
        cCanvas.width = cw;
        cCanvas.height = ch;
        const segment = ctx.getImageData(csx, sy, cw, ch);
        cCanvas.getContext('2d').putImageData(segment, 0, 0);
        chars.push(cCanvas.toDataURL('image/png'));
      }
      chars.push(' ');
    }
    chars.push(' ');
  }
  return chars;
}

export async function evaluateQuality(dataUrl){
  const img = await dataUrlToImage(dataUrl);
  const size = CONFIG.calib.squareSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0,0,size,size);
  let sum=0; let inkPixels=0; let edgeSum=0;
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const idx = (y*size + x)*4;
      const [r,g,b] = [data[idx], data[idx+1], data[idx+2]];
      const gray = (0.299*r + 0.587*g + 0.114*b);
      sum += gray;
      const ink = 255 - gray;
      if(ink > 60) inkPixels++;
      if(x>0){
        const prevIdx = idx-4;
        const [pr,pg,pb] = [data[prevIdx], data[prevIdx+1], data[prevIdx+2]];
        const pGray = (0.299*pr + 0.587*pg + 0.114*pb);
        edgeSum += Math.abs(pGray - gray);
      }
      if(y>0){
        const prevIdx = idx - size*4;
        const [pr,pg,pb] = [data[prevIdx], data[prevIdx+1], data[prevIdx+2]];
        const pGray = (0.299*pr + 0.587*pg + 0.114*pb);
        edgeSum += Math.abs(pGray - gray);
      }
    }
  }
  const totalPixels = size*size;
  const avgBright = sum / totalPixels;
  const inkPct = (inkPixels / totalPixels) * 100;
  const edgeAvg = edgeSum / (totalPixels*2);
  const warnings=[];
  if(avgBright < CONFIG.quality.brightMin) warnings.push('Imagine prea întunecată');
  if(avgBright > CONFIG.quality.brightMax) warnings.push('Imagine prea luminoasă');
  if(inkPct < CONFIG.quality.minInkPct) warnings.push('Caracter prea mic — puțină cerneală');
  if(edgeAvg < CONFIG.quality.minEdgeAvg) warnings.push('Imagine neclară / mișcată');
  return { avgBright: Math.round(avgBright), inkPct: Math.round(inkPct*10)/10, edgeAvg: Math.round(edgeAvg*10)/10, warnings };
}
