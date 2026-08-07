import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const isWorkspace = fs.existsSync('/workspace');
const UPLOADS_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : isWorkspace ? '/workspace/uploads' : path.join(process.cwd(), 'uploads');
const DB_FILE = process.env.VERCEL ? path.join('/tmp', 'db.json') : isWorkspace ? '/workspace/db.json' : path.join(process.cwd(), 'db.json');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Simple JSON database with in-memory caching for zero race conditions
let dbCache: { videos: any[] } | null = null;

const getDb = () => {
  if (!dbCache) {
    if (fs.existsSync(DB_FILE)) {
      try {
        dbCache = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      } catch (e) {
        dbCache = { videos: [] };
      }
    } else {
      dbCache = { videos: [] };
    }
  }
  if (!dbCache || !Array.isArray(dbCache.videos)) {
    dbCache = { videos: [] };
  }
  return dbCache;
};

const saveDb = (data: any) => {
  dbCache = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save DB_FILE:', e);
  }
};

// Multer setup for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

app.use(express.json());

// Custom video streaming endpoint with HTTP 206 Range support for seamless browser playback
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(req.params.filename).toLowerCase();
  let contentType = 'video/mp4';
  if (ext === '.webm') contentType = 'video/webm';
  if (ext === '.ogg' || ext === '.ogv') contentType = 'video/ogg';
  if (ext === '.mov') contentType = 'video/quicktime';
  if (ext === '.m4v') contentType = 'video/x-m4v';
  if (ext === '.mkv') contentType = 'video/x-matroska';
  if (ext === '.avi') contentType = 'video/x-msvideo';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
app.post('/api/upload-chunk', upload.single('chunk'), (req, res) => {
  const { uploadId, chunkIndex } = req.body;
  const chunkFile = req.file;

  if (!chunkFile || !uploadId || chunkIndex === undefined) {
    return res.status(400).json({ error: 'Missing chunk data' });
  }

  const chunkPath = path.join(UPLOADS_DIR, `${uploadId}_${chunkIndex}`);
  fs.renameSync(chunkFile.path, chunkPath);

  res.json({ success: true });
});

app.post('/api/upload-complete', express.json(), async (req, res) => {
  const { uploadId, fileName, mimeType, size, totalChunks, title, tags } = req.body;
  
  if (!uploadId || !fileName || totalChunks === undefined) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  if (size && size > 100 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size exceeds the 100MB maximum limit.' });
  }

  const id = uuidv4();
  const ext = path.extname(fileName) || '.mp4';
  const finalFileName = `${id}${ext}`;
  const finalPath = path.join(UPLOADS_DIR, finalFileName);

  const writeStream = fs.createWriteStream(finalPath);

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(UPLOADS_DIR, `${uploadId}_${i}`);
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing chunk ${i}`);
      }
      
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
          fs.unlinkSync(chunkPath);
          resolve(null);
        });
        readStream.on('error', reject);
      });
    }
    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(null));
      writeStream.on('error', reject);
      writeStream.end();
    });

    const cleanTitle = (typeof title === 'string' && title.trim()) ? title.trim() : fileName;
    
    let processedTags: string[] = [];
    if (Array.isArray(tags)) {
      processedTags = tags.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string') {
      processedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    const newVideo = {
      id,
      filename: finalFileName,
      originalName: cleanTitle,
      mimetype: mimeType,
      size,
      downloadUrl: `/uploads/${finalFileName}`,
      tags: processedTags,
      createdAt: new Date().toISOString()
    };

    const db = getDb();
    db.videos.unshift(newVideo);
    saveDb(db);

    res.json({ success: true, video: newVideo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to merge chunks' });
  }
});

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

app.get('/api/videos/:id', (req, res) => {
  const db = getDb();
  const video = db.videos.find((v: any) => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  res.json(video);
});

app.post('/api/videos/:id/view', (req, res) => {
  const db = getDb();
  const video = db.videos.find((v: any) => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  video.viewCount = (video.viewCount || 0) + 1;
  saveDb(db);

  res.json({ success: true, viewCount: video.viewCount });
});

app.put('/api/videos/:id/tags', express.json(), (req, res) => {
  const db = getDb();
  const video = db.videos.find((v: any) => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const { tags } = req.body;
  if (Array.isArray(tags)) {
    video.tags = tags.map((t: any) => String(t).trim()).filter(Boolean);
  } else if (typeof tags === 'string') {
    video.tags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  } else {
    video.tags = [];
  }

  saveDb(db);
  res.json({ success: true, video });
});

app.delete('/api/videos/:id', (req, res) => {
  const db = getDb();
  const index = db.videos.findIndex((v: any) => v.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Video not found' });
  }
  const video = db.videos[index];
  
  const filePath = path.join(UPLOADS_DIR, video.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  }

  db.videos.splice(index, 1);
  saveDb(db);
  res.json({ success: true });
});

let viteInstance: any = null;

// Dynamic Open Graph / Twitter card preview for shared video links
app.get('/v/:id', async (req, res, next) => {
  const db = getDb();
  const video = db.videos.find((v: any) => v.id === req.params.id);

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const fullUrl = `${protocol}://${host}/v/${req.params.id}`;

  const videoTitle = video?.originalName ? video.originalName : 'Shared Video';
  const title = `${videoTitle} - StreamShare Pro`;
  const description = video 
    ? `Watch "${video.originalName}" on StreamShare Pro. High performance video streaming.`
    : 'Stream and share high-quality videos instantly with StreamShare Pro.';
  const videoUrl = video ? `${protocol}://${host}/uploads/${video.filename}` : '';
  const siteName = 'StreamShare Pro';

  let htmlPath = path.join(process.cwd(), 'index.html');
  if (process.env.NODE_ENV === 'production') {
    htmlPath = path.join(process.cwd(), 'dist', 'index.html');
  }

  if (fs.existsSync(htmlPath)) {
    try {
      let html = fs.readFileSync(htmlPath, 'utf-8');

      if (viteInstance && process.env.NODE_ENV !== 'production') {
        html = await viteInstance.transformIndexHtml(req.originalUrl, html);
      }

      const metaTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta name="description" content="${escapeHtml(description)}" />

    <!-- Open Graph / Facebook / WhatsApp / Telegram / Discord -->
    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:url" content="${escapeHtml(fullUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    ${videoUrl ? `<meta property="og:video" content="${escapeHtml(videoUrl)}" />
    <meta property="og:video:secure_url" content="${escapeHtml(videoUrl)}" />
    <meta property="og:video:type" content="video/mp4" />` : ''}

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeHtml(fullUrl)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
      `;

      html = html.replace(/<title>.*?<\/title>/i, '');
      html = html.replace('</head>', `${metaTags}\n</head>`);

      return res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (e) {
      console.error('Error rendering HTML meta tags:', e);
      return next();
    }
  }
  next();
});

// Vite Integration for full-stack React serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(viteInstance.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

startServer();

export default app;
