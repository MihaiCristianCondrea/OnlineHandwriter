export async function startCamera(videoEl, currentStream){
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
