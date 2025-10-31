const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// helper para generar ID estable (basado en orden del array)
function buildTracks(files) {
  const audioFiles = files.filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f))
    .sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // orden alfabético
  return audioFiles.map((f,i) => ({
    id: i + 1,
    filename: f,
    url: `/music/${encodeURIComponent(f)}`
  }));
}

app.get('/api/tracks', async (req, res) => {
  try {
    const musicDir = path.join(__dirname, 'public', 'music');
    const files = await fs.readdir(musicDir);
    const tracks = buildTracks(files);
    res.json(tracks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo listar tracks' });
  }
});

app.listen(PORT, () => console.log(`Server listening http://localhost:${PORT}`));