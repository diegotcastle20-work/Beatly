// app.js
let tracks = [];
let currentIndex = 0;
const audio = new Audio();
const playlistEl = document.getElementById('playlist');
const btnPlay = document.getElementById('btnPlay');
const btnNext = document.getElementById('btnNext');
const btnPrev = document.getElementById('btnPrev');
const trackTitle = document.getElementById('trackTitle');
const seek = document.getElementById('seek');

async function loadTracks(){
  const res = await fetch('/api/tracks');
  tracks = await res.json();
  renderPlaylist();
  if (tracks.length) setTrack(0);
}

function renderPlaylist(){
  playlistEl.innerHTML = tracks.map((t,i) =>
    `<div class="track" data-index="${i}">${i+1}. ${t.filename}</div>`).join('');
  playlistEl.addEventListener('click', e=>{
    const el = e.target.closest('.track');
    if(!el) return;
    const idx = Number(el.dataset.index);
    setTrack(idx);
    play();
  });
}

function setTrack(idx){
  currentIndex = idx;
  audio.src = tracks[idx].url;
  trackTitle.textContent = tracks[idx].filename;
  audio.load();
}

function play(){ audio.play(); btnPlay.textContent = 'Pause'; }
function pause(){ audio.pause(); btnPlay.textContent = 'Play'; }

btnPlay.addEventListener('click', ()=>{
  if (audio.paused) play(); else pause();
});
btnNext.addEventListener('click', ()=> {
  if (currentIndex < tracks.length -1) setTrack(currentIndex+1);
  else setTrack(0);
  play();
});
btnPrev.addEventListener('click', ()=> {
  if (currentIndex > 0) setTrack(currentIndex-1);
  else setTrack(tracks.length-1);
  play();
});

audio.addEventListener('timeupdate', ()=>{
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  seek.value = pct;
});
seek.addEventListener('input', ()=>{
  if (!audio.duration) return;
  audio.currentTime = (seek.value / 100) * audio.duration;
});

loadTracks().catch(err=>console.error(err));
