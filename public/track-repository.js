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
    // id es el filename; encodearlo para evitar problemas con espacios/caracteres
    const res = await fetch(`/api/tracks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  }
}

window.trackRepository = new TrackRepository();