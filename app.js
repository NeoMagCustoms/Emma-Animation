/* PaperCut Animator – tiny stop-motion tool (client-only) */
// Minimal project state
const state = {
  frames: [], // each: { img: HTMLImageElement, dataURL: string }
  fps: 12,
  onion: 2,
  onionAlpha: 0.3,
  playing: false,
  playHandle: null,
  currentIndex: 0
};

// DOM
const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
const timeline = document.getElementById('timeline');
const fileInput = document.getElementById('file-input');
const btnImport = document.getElementById('btn-import');
const btnSnap = document.getElementById('btn-snap');
const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');
const btnExportGIF = document.getElementById('btn-export-gif');
const btnExportWebM = document.getElementById('btn-export-webm');
const btnClear = document.getElementById('btn-clear');
const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const fpsInput = document.getElementById('fps');
const onionInput = document.getElementById('onion');
const onionAlpha = document.getElementById('onionAlpha');
const cameraEl = document.getElementById('camera');

// Setup
fpsInput.addEventListener('input', () => state.fps = +fpsInput.value);
onionInput.addEventListener('input', () => state.onion = +onionInput.value);
onionAlpha.addEventListener('input', () => state.onionAlpha = +onionAlpha.value);
btnImport.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
btnPlay.addEventListener('click', () => play());
btnStop.addEventListener('click', () => stop());
btnExportGIF.addEventListener('click', exportGIF);
btnExportWebM.addEventListener('click', exportWebM);
btnClear.addEventListener('click', newProject);
btnSave.addEventListener('click', saveProject);
btnLoad.addEventListener('click', loadProject);
btnSnap.addEventListener('click', snapFromCamera);

timeline.innerHTML = '<div class="frame-list" id="frame-list"></div>';

function handleFiles(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = evt => addFrameFromDataURL(evt.target.result);
    reader.readAsDataURL(file);
  });
  fileInput.value = '';
}

function addFrameFromDataURL(dataURL) {
  const img = new Image();
  img.onload = () => {
    state.frames.push({ img, dataURL });
    if (state.frames.length === 1) fitCanvasTo(img);
    renderTimeline();
    drawFrame(state.frames.length - 1);
  };
  img.src = dataURL;
}

function fitCanvasTo(img) {
  // Keep default 960x540 unless image is smaller; otherwise scale-to-fit drawing
  // We'll just draw centered letterbox style.
}

function renderTimeline() {
  const list = document.getElementById('frame-list');
  list.innerHTML = '';
  state.frames.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'frame';
    const img = document.createElement('img');
    img.src = f.dataURL;
    img.addEventListener('click', () => { stop(); state.currentIndex = i; drawFrame(i); });
    const tools = document.createElement('div');
    tools.className = 'tools';

    const up = document.createElement('button'); up.textContent = '↑';
    up.onclick = () => { if (i>0) { [state.frames[i-1], state.frames[i]] = [state.frames[i], state.frames[i-1]]; renderTimeline(); } };

    const down = document.createElement('button'); down.textContent = '↓';
    down.onclick = () => { if (i<state.frames.length-1) { [state.frames[i+1], state.frames[i]] = [state.frames[i], state.frames[i+1]]; renderTimeline(); } };

    const dup = document.createElement('button'); dup.textContent = '⎘';
    dup.title = 'Duplicate';
    dup.onclick = () => { state.frames.splice(i+1, 0, { img: f.img, dataURL: f.dataURL }); renderTimeline(); };

    const del = document.createElement('button'); del.textContent = '✖';
    del.onclick = () => { state.frames.splice(i,1); renderTimeline(); if (state.currentIndex>=state.frames.length) state.currentIndex=Math.max(0,state.frames.length-1); drawFrame(state.currentIndex); };

    tools.append(up, down, dup, del);
    div.appendChild(img);
    div.appendChild(tools);
    list.appendChild(div);
  });
}

function drawFrame(index) {
  ctx.clearRect(0,0,stage.width,stage.height);
  // Onion-skin previous frames
  for (let k = state.onion; k >= 1; k--) {
    const prev = index - k;
    if (prev >= 0 && state.frames[prev]) {
      ctx.globalAlpha = state.onionAlpha * (1 - (k-1)/state.onion);
      drawImageCentered(state.frames[prev].img);
    }
  }
  // Current frame
  ctx.globalAlpha = 1;
  if (state.frames[index]) drawImageCentered(state.frames[index].img);
}

function drawImageCentered(img) {
  // Letterbox-fit img into canvas
  const cw = stage.width, ch = stage.height;
  const iw = img.width, ih = img.height;
  const scale = Math.min(cw/iw, ch/ih);
  const w = iw*scale, h = ih*scale;
  const x = (cw - w)/2, y = (ch - h)/2;
  ctx.drawImage(img, x, y, w, h);
}

function play() {
  if (state.playing || state.frames.length===0) return;
  state.playing = true;
  btnPlay.disabled = true;
  btnStop.disabled = false;
  let i = state.currentIndex;
  const step = () => {
    if (!state.playing) return;
    drawFrame(i);
    i = (i + 1) % state.frames.length;
    state.currentIndex = i;
    state.playHandle = setTimeout(step, 1000/state.fps);
  };
  step();
}

function stop() {
  state.playing = false;
  btnPlay.disabled = false;
  btnStop.disabled = true;
  if (state.playHandle) clearTimeout(state.playHandle);
}

async function exportGIF() {
  if (state.frames.length===0) return;
  stop();
  const enc = gifenc.GIFEncoder(stage.width, stage.height);
  for (let i=0;i<state.frames.length;i++){
    // draw each frame on canvas at full quality
    drawFrame(i);
    const imgData = ctx.getImageData(0,0,stage.width,stage.height);
    // gifenc expects indexed data; we'll approximate by taking the R channel (fast & simple)
    // Better quality would use quantization; for MVP we'll let gifenc handle internal mapping.
    enc.addFrame({ indexed: Array.from(imgData.data).filter((_,j)=>j%4===0), delay: Math.round(1000/state.fps) });
  }
  const bytes = enc.finish("PaperCut");
  const blob = new Blob([bytes], {type:'image/gif'});
  downloadBlob(blob, 'animation.gif');
}

async function exportWebM() {
  if (!('MediaRecorder' in window)) {
    alert('MediaRecorder not supported in this browser.');
    return;
  }
  stop();
  const stream = stage.captureStream(state.fps);
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    downloadBlob(blob, 'animation.webm');
  };
  rec.start();
  // play frames for one loop, then stop
  let i = 0;
  const step = () => {
    drawFrame(i);
    i++;
    if (i < state.frames.length) {
      setTimeout(step, 1000/state.fps);
    } else {
      setTimeout(() => rec.stop(), 100);
    }
  };
  step();
}

function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

function newProject(){
  if (!confirm('Start a new project? Unsaved frames will be lost.')) return;
  state.frames = [];
  state.currentIndex = 0;
  renderTimeline();
  ctx.clearRect(0,0,stage.width,stage.height);
}

function saveProject(){
  const data = {
    fps: state.fps,
    onion: state.onion,
    onionAlpha: state.onionAlpha,
    frames: state.frames.map(f => f.dataURL)
  };
  localStorage.setItem('papercut.project', JSON.stringify(data));
  alert('Saved locally.');
}

function loadProject(){
  const raw = localStorage.getItem('papercut.project');
  if (!raw) { alert('No saved project found.'); return; }
  const data = JSON.parse(raw);
  state.fps = data.fps ?? 12;
  state.onion = data.onion ?? 2;
  state.onionAlpha = data.onionAlpha ?? 0.3;
  fpsInput.value = state.fps;
  onionInput.value = state.onion;
  onionAlpha.value = state.onionAlpha;
  state.frames = [];
  (data.frames||[]).forEach(addFrameFromDataURL);
}

async function snapFromCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    cameraEl.srcObject = stream;
    cameraEl.hidden = false;
    // Draw one photo into canvas then add as frame
    await new Promise(r => setTimeout(r, 300)); // warm-up
    const tmp = document.createElement('canvas');
    tmp.width = cameraEl.videoWidth || 960;
    tmp.height = cameraEl.videoHeight || 540;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(cameraEl, 0, 0, tmp.width, tmp.height);
    const dataURL = tmp.toDataURL('image/png');
    addFrameFromDataURL(dataURL);
    stream.getTracks().forEach(t=>t.stop());
    cameraEl.hidden = true;
  }catch(err){
    alert('Camera unavailable.');
    console.error(err);
  }
}
