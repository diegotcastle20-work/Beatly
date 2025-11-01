// public/js/app.js
// Código cliente centralizado y sin listeners duplicados

// Elementos UI
const playlistEl = document.getElementById('playlist');
const btnPlay = document.getElementById('btnPlay');
const btnNext = document.getElementById('btnNext');
const btnPrev = document.getElementById('btnPrev');
const trackTitle = document.getElementById('trackTitle');
const seek = document.getElementById('seek');
const timeCurrent = document.getElementById('timeCurrent');
const timeTotal = document.getElementById('timeTotal');

const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const uploadMessage = document.getElementById('uploadMessage');

let tracks = [];
let currentIndex = 0;
const audio = new Audio();
audio.preload = 'metadata';

// --- Helpers ---
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s]);
}
function formatTime(sec = 0) {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const s = Math.floor(sec % 60).toString().padStart(2,'0');
  const m = Math.floor(sec / 60);
  return `${m}:${s}`;
}

// --- RENDER PLAYLIST (solo produce DOM) ---
function renderPlaylist(){
  // build markup with play & delete buttons
  playlistEl.innerHTML = tracks.map((t,i) =>
    `<div class="track" data-id="${encodeURIComponent(t.id)}" data-index="${i}">
       <div class="left">
         <div class="num">${i+1}</div>
         <div class="meta">
           <div class="title">${escapeHtml(t.filename)}</div>
           <div class="small">Archivo</div>
         </div>
       </div>
       <div class="right">
         <button class="icon-btn" data-action="play" data-index="${i}" aria-label="Reproducir">▶</button>
         <button class="icon-btn" data-action="delete" data-id="${encodeURIComponent(t.id)}" aria-label="Eliminar">✖</button>
       </div>
     </div>`).join('');

  markActive(currentIndex);
}

function markActive(idx){
  const nodes = playlistEl.querySelectorAll('.track');
  nodes.forEach(n => n.classList.remove('active'));
  const el = playlistEl.querySelector(`.track[data-index="${idx}"]`);
  if (el) el.classList.add('active');
}

// --- Setear pista actual ---
function setTrack(idx) {
  if (!tracks || tracks.length === 0) return;
  if (idx < 0 || idx >= tracks.length) return;
  currentIndex = idx;
  audio.src = tracks[idx].url;
  trackTitle.textContent = tracks[idx].filename;
  audio.load();
  markActive(idx);
}

// --- Reproducción (asegurar manejo de promesas) ---
async function play(){
  try {
    // Si el navegador bloquea el AudioContext resume/resuelve; manejado en visualizer
    await audio.play();
    btnPlay.textContent = '⏸';
  } catch (err) {
    // Autoplay o error -> informar en consola
    console.warn('play error', err);
  }
}
function pause(){
  audio.pause();
  btnPlay.textContent = '▶';
}

// --- Cargar tracks desde el servidor ---
async function loadTracks() {
  try {
    const res = await window.trackRepository.getTracks();
    tracks = Array.isArray(res) ? res : [];
    renderPlaylist();
    if (tracks.length) {
      // si audio.src está vacío, setear la primera
      if (!audio.src) setTrack(0);
      // actualizar tiempos si ya hay metadata
    } else {
      trackTitle.textContent = '';
      audio.src = '';
      timeCurrent.textContent = '0:00';
      timeTotal.textContent = '0:00';
    }
  } catch (err) {
    console.error('loadTracks error', err);
  }
}

// --- Listeners (única delegación) ---
function initListeners() {
  // Delegación en playlist: manejo reproducir/eliminar y click en fila
  playlistEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    const item = e.target.closest('.track');
    if (!btn && !item) return;

    // Botones
    if (btn) {
      const action = btn.dataset.action;
      if (action === 'play') {
        const idx = Number(btn.dataset.index);
        setTrack(idx);
        // asegurar visual & play
        maybeConnectVisualizer();
        await play();
        return;
      }
      if (action === 'delete') {
        const idEncoded = btn.dataset.id;
        const id = decodeURIComponent(idEncoded);
        if (!confirm('¿Eliminar esta pista?')) return;
        try {
          const ok = await window.trackRepository.deleteTrack(id);
          if (ok) {
            await loadTracks();
            // reajustar indice si era la actual
            if (currentIndex >= tracks.length) currentIndex = Math.max(0, tracks.length-1);
            if (tracks.length) setTrack(currentIndex);
          } else {
            alert('No se pudo eliminar la pista');
          }
        } catch (err) {
          console.error('delete error', err);
          alert('Error al eliminar');
        }
        return;
      }
    }

    // Click en la fila -> reproducir
    if (item) {
      const idx = Number(item.dataset.index);
      setTrack(idx);
      maybeConnectVisualizer();
      await play();
    }
  });

  // controles de reproductor
  btnPlay.addEventListener('click', async ()=> {
    if (audio.paused) {
      maybeConnectVisualizer();
      await play();
    } else {
      pause();
    }
  });
  btnNext.addEventListener('click', ()=> {
    if (!tracks.length) return;
    const next = (currentIndex < tracks.length -1) ? currentIndex + 1 : 0;
    setTrack(next);
    maybeConnectVisualizer();
    play();
  });
  btnPrev.addEventListener('click', ()=> {
    if (!tracks.length) return;
    const prev = (currentIndex > 0) ? currentIndex - 1 : tracks.length - 1;
    setTrack(prev);
    maybeConnectVisualizer();
    play();
  });

  // asegura que btnPlay exista
  if (btnPlay) {
    audio.addEventListener('play', () => btnPlay.classList.add('playing'));
    audio.addEventListener('pause', () => btnPlay.classList.remove('playing'));
    audio.addEventListener('ended', () => btnPlay.classList.remove('playing'));
  }

  // seek
  audio.addEventListener('timeupdate', ()=>{
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    seek.value = pct;
    timeCurrent.textContent = formatTime(audio.currentTime);
  });
  seek.addEventListener('input', ()=>{
    if (!audio.duration) return;
    audio.currentTime = (seek.value / 100) * audio.duration;
  });

  // loadedmetadata -> duración total
  audio.addEventListener('loadedmetadata', () => {
    timeTotal.textContent = formatTime(audio.duration);
    timeCurrent.textContent = formatTime(audio.currentTime);
  });

  // SUBIDA: listener único
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      uploadMessage.textContent = '';
      const file = fileInput.files[0];
      if (!file) {
        uploadMessage.textContent = 'Selecciona un archivo';
        return;
      }

      uploadMessage.textContent = 'Subiendo...';
      try {
        const created = await window.trackRepository.uploadTrack(file);
        if (created) {
          uploadMessage.textContent = 'Subida OK';
          await loadTracks();            // refrescar lista desde servidor
          uploadForm.reset();
          setTimeout(()=> uploadMessage.textContent = '', 2500);
        } else {
          uploadMessage.textContent = 'Error en la subida';
        }
      } catch (err) {
        console.error('upload error', err);
        uploadMessage.textContent = 'Error al subir';
      }
    });
  }
}

// arrancar
document.addEventListener('DOMContentLoaded', async () => {
  initListeners();
  await loadTracks();
});

// --- WAVEFORM VISUAL (mejorado) ---
const canvas = document.getElementById('waveCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let dataArray = null;
let rafId = null;
let bufferLength = 0;

// ajustar canvas para devicePixelRatio y tamaño responsive
function resizeCanvas() {
  if (!canvas || !ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.floor(cssW * ratio);
  canvas.height = Math.floor(cssH * ratio);
  // trabajar en coordenadas CSS (escala por ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener('resize', () => {
  resizeCanvas();
});

// Inicializa AudioContext y analyser (solo una vez)
function initAudioVisual() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048; // resolución del buffer
  analyser.smoothingTimeConstant = 0.85; // suavizado
  bufferLength = analyser.fftSize;
  dataArray = new Uint8Array(bufferLength);
  resizeCanvas();
}

// conectar el audio element al visualizador (solo una vez)
function maybeConnectVisualizer() {
  try {
    initAudioVisual();
    if (!sourceNode) {
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
    // iniciar loop de dibujo si no está ya corriendo
    if (!rafId) draw();
  } catch (e) {
    // algunos navegadores bloquean AudioContext hasta interacción, se maneja en try
    console.warn('Visualizador no conectado:', e);
  }
}

// función para dibujar onda suavizada y con relleno
function draw() {
  if (!analyser || !ctx || !canvas) return;

  rafId = requestAnimationFrame(draw);
  analyser.getByteTimeDomainData(dataArray);

  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  ctx.clearRect(0, 0, cssW, cssH);

  // parámetros visuales
  const padding = 8; // espacio arriba/abajo
  const midY = cssH / 2;
  const amplitude = (cssH / 2) - padding;

  // construir puntos muestreando para dimensionar a la anchura (no hace falta 1:1)
  const step = Math.max(1, Math.floor(bufferLength / cssW));
  const points = [];
  for (let x = 0, i = 0; x < cssW && i < bufferLength; x++, i += step) {
    const v = dataArray[i] / 128.0 - 1.0; // -1 .. 1
    const y = midY + v * amplitude;
    points.push({ x, y });
  }

  if (points.length < 2) return;

  // crear gradiente para relleno
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, 'rgba(107,92,255,0.85)');
  grad.addColorStop(0.6, 'rgba(107,92,255,0.35)');
  grad.addColorStop(1, 'rgba(107,92,255,0.06)');

  // dibujar área rellena usando curvas
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const cx = (prev.x + cur.x) / 2;
    const cy = (prev.y + cur.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
  }
  // cerrar por la parte inferior (relleno)
  ctx.lineTo(cssW, cssH);
  ctx.lineTo(0, cssH);
  ctx.closePath();

  // sombra suave / glow
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(107,92,255,0.45)';
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // trazo principal de la onda (más nítido)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const cx = (prev.x + cur.x) / 2;
    const cy = (prev.y + cur.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // trazo secundario para borde de color
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const cx = (prev.x + cur.x) / 2;
    const cy = (prev.y + cur.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
  }
  ctx.strokeStyle = 'rgba(107,92,255,0.8)';
  ctx.lineWidth = 1.2;
  ctx.globalCompositeOperation = 'lighter';
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

// detener animación cuando se pause/termine (ahorrar CPU)
audio.addEventListener('pause', () => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});
audio.addEventListener('ended', () => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});

// cuando el usuario interactúe para reproducir, reanudar AudioContext si está suspendido
btnPlay.addEventListener('click', async () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (e) { /* ignore */ }
  }
});
