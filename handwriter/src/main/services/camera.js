export async function startCamera(videoEl, currentStream){
  const secureOk = window.isSecureContext || ['localhost','127.0.0.1'].includes(window.location.hostname);
  if(!secureOk){
    throw new Error('Camera necesită HTTPS / context securizat.');
  }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    throw new Error('Camera nu este disponibilă în acest browser.');
  }
  if(currentStream){
    videoEl.srcObject = currentStream;
    await videoEl.play();
    return currentStream;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream){
  if(stream){
    stream.getTracks().forEach(track => track.stop());
  }
}
