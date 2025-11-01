// public/js/trackRepository.js
class TrackRepository {
  async getTracks() {
    const res = await fetch('/api/tracks');
    return res.ok ? await res.json() : [];
  }
  async uploadTrack(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/tracks', { method: 'POST', body: fd });
    return res.ok ? await res.json() : null;
  }
  async deleteTrack(id) {
    // id ya es filename (string), hay que encode para URL
    const res = await fetch(`/api/tracks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok ? await res.json() : null;
  }
}
window.trackRepository = new TrackRepository();
