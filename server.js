// servidor.js (CommonJS)
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// servir carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// endpoint que lista archivos en public/music
app.get('/api/tracks', async (req, res) => {
  try {
    const musicDir = path.join(__dirname, 'public', 'music');
    const files = await fs.readdir(musicDir);
    // filtrar por extensiones comunes de audio
    const audioFiles = files.filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f))
      .map((f, i) => ({ id: i + 1, filename: f, url: `/music/${encodeURIComponent(f)}` }));
    res.json(audioFiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo listar tracks' });
  }
});

app.listen(PORT, () => console.log(`Server listening http://localhost:${PORT}`));
