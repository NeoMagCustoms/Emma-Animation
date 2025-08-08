/* PaperCut Animator – tiny stop-motion tool (client-only) */
// Enhanced project state with sprite support
const state = {
  frames: [], // each: { sprites: [{id, x, y, scale, rot}...], background?: dataURL }
  assets: {}, // sprite assets: { id: { src: dataURL, w, h, pivot: {x, y} } }
  fps: 12,
  onion: 2,
  onionAlpha: 0.3,
  playing: false,
  playHandle: null,
  currentIndex: 0,
  selectedSprite: null,
  tool: 'select', // 'select', 'lasso'
  lassoPoints: [],
  dragState: null,
  background: { type: 'color', value: '#0b0e14' },
  width: 960,
  height: 540
};

// DOM
const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
const timeline = document.getElementById('timeline');
const fileInput = document.getElementById('file-input');
const btnImportBG = document.getElementById('btn-import-bg');
const btnImport = document.getElementById('btn-import');
const btnLasso = document.getElementById('btn-lasso');
const btnSelect = document.getElementById('btn-select');
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
btnImportBG.addEventListener('click', () => {
  state.importMode = 'background';
  fileInput.click();
});
btnImport.addEventListener('click', () => {
  state.importMode = 'sprite';
  fileInput.click();
});
btnLasso.addEventListener('click', () => {
  state.tool = 'lasso';
  btnLasso.classList.add('active');
  btnSelect.classList.remove('active');
});
btnSelect.addEventListener('click', () => {
  state.tool = 'select';
  btnSelect.classList.add('active');
  btnLasso.classList.remove('active');
});
fileInput.addEventListener('change', handleFiles);
btnPlay.addEventListener('click', () => play());
btnStop.addEventListener('click', () => stop());
btnExportGIF.addEventListener('click', exportGIF);
btnExportWebM.addEventListener('click', exportWebM);
btnClear.addEventListener('click', newProject);
btnSave.addEventListener('click', saveProject);
btnLoad.addEventListener('click', loadProject);
btnSnap.addEventListener('click', snapFromCamera);

// Set initial tool
btnSelect.classList.add('active');

timeline.innerHTML = '<div class="frame-list" id="frame-list"></div>';

function handleFiles(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  
  if (state.importMode === 'background') {
    // Import as background
    const file = files[0];
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        state.background = { type: 'image', value: evt.target.result, img };
        drawFrame(state.currentIndex);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  } else if (state.importMode === 'sprite') {
    // Import as sprite or for lasso
    if (state.tool === 'lasso') {
      // Store source for lasso
      const file = files[0];
      const reader = new FileReader();
      reader.onload = evt => {
        state.lassoSource = evt.target.result;
        alert('Draw a lasso around the area you want to cut out');
      };
      reader.readAsDataURL(file);
    } else {
      // Import as sprite directly
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = async evt => {
          const spriteId = await createSpriteFromImage(evt.target.result);
          
          // Add to current frame
          if (state.frames.length === 0) {
            state.frames.push({ sprites: [] });
          }
          
          const currentFrame = state.frames[state.currentIndex];
          currentFrame.sprites.push({
            id: spriteId,
            x: state.width / 2,
            y: state.height / 2,
            scale: 1,
            rot: 0
          });
          
          drawFrame(state.currentIndex);
        };
        reader.readAsDataURL(file);
      });
    }
  }
  
  fileInput.value = '';
}

function addFrameFromDataURL(dataURL) {
  // For backward compatibility, convert old format to new
  if (state.frames.length === 0) {
    // First frame - add empty frame
    state.frames.push({ sprites: [] });
  } else {
    // Duplicate previous frame's sprites
    const prev = state.frames[state.frames.length - 1];
    state.frames.push({ 
      sprites: prev.sprites.map(s => ({...s}))
    });
  }
  renderTimeline();
  state.currentIndex = state.frames.length - 1;
  drawFrame(state.currentIndex);
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
    dup.onclick = () => { 
      // Duplicate frame with all sprites
      const duplicated = {
        sprites: f.sprites ? f.sprites.map(s => ({...s})) : []
      };
      state.frames.splice(i+1, 0, duplicated); 
      renderTimeline(); 
    };

    const del = document.createElement('button'); del.textContent = '✖';
    del.onclick = () => { state.frames.splice(i,1); renderTimeline(); if (state.currentIndex>=state.frames.length) state.currentIndex=Math.max(0,state.frames.length-1); drawFrame(state.currentIndex); };

    tools.append(up, down, dup, del);
    div.appendChild(img);
    div.appendChild(tools);
    list.appendChild(div);
  });
}

function drawFrame(index) {
  ctx.clearRect(0, 0, stage.width, stage.height);
  
  // Draw background
  if (state.background.type === 'color') {
    ctx.fillStyle = state.background.value;
    ctx.fillRect(0, 0, stage.width, stage.height);
  } else if (state.background.type === 'image' && state.background.img) {
    drawImageCentered(state.background.img);
  }
  
  // Onion-skin previous frames
  for (let k = state.onion; k >= 1; k--) {
    const prev = index - k;
    if (prev >= 0 && state.frames[prev]) {
      ctx.globalAlpha = state.onionAlpha * (1 - (k-1)/state.onion);
      drawFrameSprites(prev);
    }
  }
  
  // Current frame
  ctx.globalAlpha = 1;
  if (state.frames[index]) {
    drawFrameSprites(index);
  }
  
  // Draw lasso if active
  if (state.tool === 'lasso' && state.lassoPoints.length > 0) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    state.lassoPoints.forEach(([x, y], i) => {
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawFrameSprites(index) {
  const frame = state.frames[index];
  if (!frame || !frame.sprites) return;
  
  frame.sprites.forEach(sprite => {
    const asset = state.assets[sprite.id];
    if (asset) {
      drawSprite(sprite, asset, ctx);
    }
  });
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
    width: state.width,
    height: state.height,
    background: state.background,
    assets: state.assets,
    frames: state.frames
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
  state.width = data.width ?? 960;
  state.height = data.height ?? 540;
  state.background = data.background ?? { type: 'color', value: '#0b0e14' };
  state.assets = data.assets ?? {};
  state.frames = data.frames ?? [];
  
  fpsInput.value = state.fps;
  onionInput.value = state.onion;
  onionAlpha.value = state.onionAlpha;
  
  // Load background image if needed
  if (state.background.type === 'image' && state.background.value) {
    const img = new Image();
    img.onload = () => {
      state.background.img = img;
      renderTimeline();
      drawFrame(0);
    };
    img.src = state.background.value;
  } else {
    renderTimeline();
    drawFrame(0);
  }
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

// Lasso cutout functionality
function makeCutout(dataURL, polygon) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const octx = off.getContext('2d');
      // draw polygon mask
      octx.save();
      octx.beginPath();
      polygon.forEach(([px,py], i) => i ? octx.lineTo(px,py) : octx.moveTo(px,py));
      octx.closePath();
      octx.clip();
      // draw image inside the mask
      octx.drawImage(img, 0, 0, w, h);
      octx.restore();
      // export as PNG cutout
      resolve({ dataURL: off.toDataURL('image/png'), w, h });
    };
    img.src = dataURL;
  });
}

// Sprite drawing
function drawSprite(s, asset, ctx) {
  if (!asset.__img || !asset.__img.complete) {
    asset.__img = new Image();
    asset.__img.src = asset.src;
    if (!asset.__img.complete) return;
  }
  
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot || 0);
  ctx.scale(s.scale || 1, s.scale || 1);
  const ax = -asset.w * (asset.pivot?.x || 0.5);
  const ay = -asset.h * (asset.pivot?.y || 0.5);
  ctx.drawImage(asset.__img, ax, ay, asset.w, asset.h);
  ctx.restore();
}

// Hit testing for sprites
function hitTestSprite(x, y, sprite, asset) {
  const dx = x - sprite.x;
  const dy = y - sprite.y;
  const s = sprite.scale || 1;
  const halfW = (asset.w * s) / 2;
  const halfH = (asset.h * s) / 2;
  return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
}

// Find top sprite at point
function pickTopSpriteAtPoint(p) {
  const frame = state.frames[state.currentIndex];
  if (!frame || !frame.sprites) return null;
  
  for (let i = frame.sprites.length - 1; i >= 0; i--) {
    const sprite = frame.sprites[i];
    const asset = state.assets[sprite.id];
    if (asset && hitTestSprite(p.x, p.y, sprite, asset)) {
      return { frameIndex: state.currentIndex, spriteIndex: i };
    }
  }
  return null;
}

// Convert mouse event to canvas coordinates
function toCanvas(e) {
  const rect = stage.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (stage.width / rect.width),
    y: (e.clientY - rect.top) * (stage.height / rect.height)
  };
}

// Mouse control handlers
stage.addEventListener('mousedown', (e) => {
  const p = toCanvas(e);
  
  if (state.tool === 'lasso') {
    state.lassoPoints = [[p.x, p.y]];
    drawFrame(state.currentIndex);
  } else if (state.tool === 'select') {
    const picked = pickTopSpriteAtPoint(p);
    if (picked) {
      state.selectedSprite = picked;
      const sprite = state.frames[picked.frameIndex].sprites[picked.spriteIndex];
      state.dragState = {
        mode: 'drag',
        start: p,
        originalSprite: { ...sprite }
      };
    }
  }
});

stage.addEventListener('mousemove', (e) => {
  const p = toCanvas(e);
  
  if (state.tool === 'lasso' && state.lassoPoints.length > 0) {
    state.lassoPoints.push([p.x, p.y]);
    drawFrame(state.currentIndex);
  } else if (state.dragState && state.selectedSprite) {
    const sprite = state.frames[state.selectedSprite.frameIndex].sprites[state.selectedSprite.spriteIndex];
    
    if (state.dragState.mode === 'drag') {
      sprite.x = state.dragState.originalSprite.x + (p.x - state.dragState.start.x);
      sprite.y = state.dragState.originalSprite.y + (p.y - state.dragState.start.y);
    } else if (state.dragState.mode === 'rotate') {
      const angle1 = Math.atan2(state.dragState.start.y - sprite.y, state.dragState.start.x - sprite.x);
      const angle2 = Math.atan2(p.y - sprite.y, p.x - sprite.x);
      sprite.rot = (state.dragState.originalSprite.rot || 0) + (angle2 - angle1);
    } else if (state.dragState.mode === 'scale') {
      const dist1 = Math.hypot(state.dragState.start.x - sprite.x, state.dragState.start.y - sprite.y);
      const dist2 = Math.hypot(p.x - sprite.x, p.y - sprite.y);
      sprite.scale = Math.max(0.1, Math.min(5, (state.dragState.originalSprite.scale || 1) * (dist2 / dist1)));
    }
    
    drawFrame(state.currentIndex);
  }
});

stage.addEventListener('mouseup', async (e) => {
  const p = toCanvas(e);
  
  if (state.tool === 'lasso' && state.lassoPoints.length > 2) {
    // Close the lasso and create cutout
    const currentFrame = state.frames[state.currentIndex];
    if (state.lassoSource) {
      const cutout = await makeCutout(state.lassoSource, state.lassoPoints);
      
      // Create unique sprite ID
      const spriteId = `spr_${Date.now()}`;
      
      // Add to assets
      state.assets[spriteId] = {
        src: cutout.dataURL,
        w: cutout.w,
        h: cutout.h,
        pivot: { x: 0.5, y: 0.5 }
      };
      
      // Add sprite to current frame
      currentFrame.sprites.push({
        id: spriteId,
        x: state.width / 2,
        y: state.height / 2,
        scale: 1,
        rot: 0
      });
      
      state.lassoPoints = [];
      state.lassoSource = null;
      state.tool = 'select';
      drawFrame(state.currentIndex);
    }
  }
  
  state.dragState = null;
});

// Helper to create sprite from imported image
function createSpriteFromImage(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const spriteId = `spr_${Date.now()}`;
      state.assets[spriteId] = {
        src: dataURL,
        w: img.width,
        h: img.height,
        pivot: { x: 0.5, y: 0.5 }
      };
      resolve(spriteId);
    };
    img.src = dataURL;
  });
}
