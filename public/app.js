// public/js/app.js
// Código cliente centralizado y sin listeners duplicados

// Elementos UI
const playlistEl = document.getElementById('playlist');
const btnPlay = document.getElementById('btnPlay');
const btnNext = document.getElementById('btnNext');
const btnPrev = document.getElementById('btnPrev');
const trackTitle = document.getElementById('trackTitle');
const seek = document.getElementById('seek');

const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const uploadMessage = document.getElementById('uploadMessage');

let tracks = [];
let currentIndex = 0;
const audio = new Audio();

// --- Utility: render playlist HTML (sin listeners) ---
function renderPlaylist(){
  playlistEl.innerHTML = tracks.map((t,i) =>
    `<div class="track" data-id="${t.id}" data-index="${i}">
       <div class="left">
         <div class="num">${i+1}</div>
         <div class="meta">
           <div class="title">${t.filename}</div>
           <div class="small">Archivo</div>
         </div>
       </div>
       <div class="right small">↳</div>
     </div>`).join('');

  // listener (delegación)
  playlistEl.addEventListener('click', e=>{
    const el = e.target.closest('.track');
    if(!el) return;
    const idx = Number(el.dataset.index);
    setTrack(idx);
    play();
    markActive(idx);
  });

  // marca la primera activa si existe
  markActive(currentIndex);
}

function markActive(idx){
  const nodes = playlistEl.querySelectorAll('.track');
  nodes.forEach(n => n.classList.remove('active'));
  const el = playlistEl.querySelector(`.track[data-index="${idx}"]`);
  if (el) el.classList.add('active');
}

// escape simple para evitar inyección en filenames
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s]);
}

// --- Setear pista actual ---
function setTrack(idx) {
  if (!tracks || tracks.length === 0) return;
  if (idx < 0 || idx >= tracks.length) return;
  currentIndex = idx;
  audio.src = tracks[idx].url;
  trackTitle.textContent = tracks[idx].filename;
  audio.load();
}

// --- Reproducción ---
function play(){ audio.play(); btnPlay.textContent = '⏸️ Pause'; }
function pause(){ audio.pause(); btnPlay.textContent = '▶️ Play'; }

// --- Cargar tracks desde el servidor ---
async function loadTracks() {
  try {
    const res = await window.trackRepository.getTracks();
    tracks = Array.isArray(res) ? res : [];
    renderPlaylist();
    if (tracks.length) {
      // si audio está vacío, mantener la posición actual o setear la primera
      if (!audio.src) setTrack(0);
    } else {
      // limpiar UI si no hay tracks
      trackTitle.textContent = '';
      audio.src = '';
    }
  } catch (err) {
    console.error('loadTracks error', err);
  }
}

// --- Inicialización de listeners (solo UNA vez) ---
function initListeners() {
  // Delegación de clicks en playlist (único listener)
  playlistEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    const item = e.target.closest('.track');
    if (!btn && !item) return;

    // Si clic en botón (play/delete)
    if (btn) {
      const action = btn.dataset.action;
      if (action === 'play') {
        const idx = Number(btn.dataset.index);
        setTrack(idx);
        play();
        return;
      }
      if (action === 'delete') {
        const id = btn.dataset.id;
        if (!confirm('¿Eliminar esta pista?')) return;
        try {
          const ok = await window.trackRepository.deleteTrack(id);
          if (ok) {
            await loadTracks();
            // si eliminaste la pista actual, reajustar índice
            if (currentIndex >= tracks.length) currentIndex = Math.max(0, tracks.length-1);
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

    // Si clic en la fila (no en botón) -> reproducir
    if (item) {
      const idx = Number(item.dataset.index);
      setTrack(idx);
      play();
    }
  });

  // botones de control
  btnPlay.addEventListener('click', ()=> {
    if (audio.paused) play(); else pause();
  });
  btnNext.addEventListener('click', ()=> {
    if (!tracks.length) return;
    setTrack((currentIndex < tracks.length -1) ? currentIndex + 1 : 0);
    play();
  });
  btnPrev.addEventListener('click', ()=> {
    if (!tracks.length) return;
    setTrack((currentIndex > 0) ? currentIndex - 1 : tracks.length - 1);
    play();
  });

  // seek
  audio.addEventListener('timeupdate', ()=>{
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    seek.value = pct;
  });
  seek.addEventListener('input', ()=>{
    if (!audio.duration) return;
    audio.currentTime = (seek.value / 100) * audio.duration;
  });

  // SUBIDA: solo UN listener (usa trackRepository.uploadTrack)
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

// --- WAVEFORM VISUAL ---
const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');
let audioCtx, analyser, sourceNode, dataArray, rafId;

function initAudioVisual() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const bufferLength = analyser.fftSize;
  dataArray = new Uint8Array(bufferLength);
}

function connectVisualizer() {
  try {
    initAudioVisual();
    if (sourceNode) sourceNode.disconnect();
    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    draw();
  } catch (e) {
    // algunos navegadores bloquean crear AudioContext antes de una interacción
    console.warn('Visualizador no conectado', e);
  }
}

function draw() {
  rafId = requestAnimationFrame(draw);
  analyser.getByteTimeDomainData(dataArray);
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = 'rgba(10,12,18,0)';
  ctx.clearRect(0,0,w,h);

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(107,92,255,0.9)';
  ctx.beginPath();
  const sliceWidth = w / dataArray.length;
  let x = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * h) / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(w, h/2);
  ctx.stroke();
}

// iniciar visual cuando haya interacción de usuario (play)
btnPlay.addEventListener('click', async () => {
  if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
  if (audio.paused) {
    // conectar visual si no está
    if (!audioCtx) connectVisualizer();
    play();
  } else pause();
});

// limpiar al pausar
audio.addEventListener('ended', ()=> {
  cancelAnimationFrame(rafId);
});
