// server.js (CommonJS) - Express + multer, usa filename como id
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const crypto = require('crypto');
const sanitize = require('sanitize-filename');

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, 'public');
const musicDir = path.join(publicDir, 'music');

// servir carpeta public
app.use(express.static(publicDir));

// crear carpeta public/music si no existe
(async () => {
  try {
    await fs.mkdir(musicDir, { recursive: true });
    console.log('music dir OK:', musicDir);
  } catch (e) {
    console.error('No se pudo crear public/music', e);
  }
})();

// multer config - guarda en public/music
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, musicDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = sanitize(path.basename(file.originalname, ext))
                  .replace(/\s+/g, '-').toLowerCase() || 'track';
    const unique = Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    cb(null, `${base}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40 MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp3|wav|ogg|m4a|flac)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'), false);
  }
});

// helper: leer archivos y construir tracks
async function listTracks() {
  const files = await fs.readdir(musicDir).catch(() => []);
  const audioFiles = files.filter(f => /\.(mp3|wav|ogg|m4a|flac)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  // id: filename (string), url: /music/<encoded filename>
  return audioFiles.map((f, i) => ({
    id: f,                 // filename como id -> persistente
    filename: f,
    url: `/music/${encodeURIComponent(f)}`,
    index: i + 1
  }));
}

// GET /api/tracks
app.get('/api/tracks', async (req, res) => {
  try {
    const tracks = await listTracks();
    res.json(tracks);
  } catch (err) {
    console.error('GET /api/tracks error', err);
    res.status(500).json({ error: 'No se pudo listar tracks' });
  }
});

// POST /api/tracks -> subir un archivo (field name: file)
app.post('/api/tracks', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const tracks = await listTracks();
    // encontrar el track subido (por filename)
    const created = tracks.find(t => t.filename === req.file.filename) || {
      id: req.file.filename,
      filename: req.file.filename,
      url: `/music/${encodeURIComponent(req.file.filename)}`
    };
    res.status(201).json(created);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

// DELETE /api/tracks/:id  -> aquí :id es el filename (url-encoded)
app.delete('/api/tracks/:id', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.id);
    const filePath = path.join(musicDir, filename);
    // verificar existencia
    await fs.stat(filePath).catch(() => null).then(async (stat) => {
      if (!stat) return res.status(404).json({ error: 'No existe track' });
      await fs.unlink(filePath);
      res.json({ ok: true, id: filename });
    });
  } catch (err) {
    console.error('DELETE error', err);
    res.status(500).json({ error: 'No se pudo eliminar' });
  }
});

app.listen(PORT, () => console.log(`Server listening http://localhost:${PORT}`));
