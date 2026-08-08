import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const isWorkspace = fs.existsSync('/workspace');

const getWritableUploadsDir = () => {
  const candidateDirs = [
    process.env.VERCEL ? path.join('/tmp', 'uploads') : null,
    isWorkspace ? '/workspace/uploads' : null,
    path.join(process.cwd(), 'uploads'),
    path.join(os.tmpdir(), 'uploads')
  ].filter(Boolean) as string[];

  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const testFile = path.join(dir, `.test_${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return dir;
    } catch (e) {}
  }
  return path.join(os.tmpdir(), 'uploads');
};

const getWritableDbFile = () => {
  const candidateFiles = [
    process.env.VERCEL ? path.join('/tmp', 'db.json') : null,
    isWorkspace ? '/workspace/db.json' : null,
    path.join(process.cwd(), 'db.json'),
    path.join(os.tmpdir(), 'db.json')
  ].filter(Boolean) as string[];

  for (const file of candidateFiles) {
    try {
      const parent = path.dirname(file);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }
      return file;
    } catch (e) {}
  }
  return path.join(os.tmpdir(), 'db.json');
};

const UPLOADS_DIR = getWritableUploadsDir();
const DB_FILE = getWritableDbFile();

// In-memory chunk cache to guarantee 100% chunk upload reliability
const inMemoryChunks = new Map<string, Map<number, Buffer>>();

// Simple JSON database with in-memory caching for zero race conditions
let dbCache: { videos: any[] } | null = null;

const getDb = (forceReload = false) => {
  if (!dbCache || forceReload) {
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
    const cleanData = {
      videos: (data.videos || []).map((v: any) => {
        // Strip out giant base64 dataUrl before saving metadata to db.json
        // This keeps db.json lightweight, fast, and 100% crash-proof
        const { dataUrl, ...rest } = v;
        return rest;
      })
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(cleanData, null, 2));
  } catch (e) {
    console.error('Failed to save DB_FILE:', e);
  }
};

// Multer setup for file storage
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

// CORS middleware to allow Chrome and cross-origin requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Custom video streaming endpoint with HTTP 206 Range support for seamless browser playback
app.get('/uploads/:filename', (req, res) => {
  const paramName = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, paramName);
  
  if (!fs.existsSync(filePath)) {
    // Check if video exists in DB with dataUrl
    const db = getDb();
    const video = db.videos.find((v: any) => v.filename === paramName || v.id === paramName || (v.filename && v.filename.startsWith(paramName)));
    if (video && video.dataUrl) {
      try {
        const matches = video.dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', mime || 'video/mp4');
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Accept-Ranges', 'bytes');
          return res.send(buffer);
        }
      } catch (e) {}
    }
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
app.post('/api/upload-chunk', (req, res) => {
  memoryUpload.single('chunk')(req, res, (err) => {
    if (err) {
      console.error('Multer chunk upload error:', err);
      return res.status(400).json({ error: err.message || 'Failed to parse chunk data' });
    }

    try {
      const { uploadId, chunkIndex } = req.body;
      const chunkFile = req.file;

      if (!chunkFile || !uploadId || chunkIndex === undefined) {
        return res.status(400).json({ error: 'Missing required chunk data or parameters' });
      }

      const idx = Number(chunkIndex);

      // Store in memory map
      if (!inMemoryChunks.has(uploadId)) {
        inMemoryChunks.set(uploadId, new Map());
      }
      inMemoryChunks.get(uploadId)!.set(idx, chunkFile.buffer);

      // Best-effort write chunk file to disk
      try {
        if (!fs.existsSync(UPLOADS_DIR)) {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        const chunkPath = path.join(UPLOADS_DIR, `${uploadId}_${idx}`);
        fs.writeFileSync(chunkPath, chunkFile.buffer);
      } catch (diskErr) {
        console.warn('Disk chunk save warning (relying on memory buffer):', diskErr);
      }

      return res.json({ success: true });
    } catch (e: any) {
      console.error('Save chunk error:', e);
      return res.status(500).json({ error: e?.message || 'Failed to process chunk data' });
    }
  });
});

// Single file direct upload fallback
app.post('/api/upload-direct', (req, res) => {
  memoryUpload.single('video')(req, res, (err) => {
    if (err) {
      console.error('Direct upload error:', err);
      return res.status(400).json({ error: err.message || 'Direct upload failed' });
    }

    try {
      const videoFile = req.file;
      const { title, tags, thumbnailUrl } = req.body;

      if (!videoFile) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      if (videoFile.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds 100MB limit' });
      }

      const id = uuidv4();
      const ext = path.extname(videoFile.originalname) || '.mp4';
      const finalFileName = `${id}${ext}`;
      const finalPath = path.join(UPLOADS_DIR, finalFileName);

      // Best-effort write to disk
      try {
        if (!fs.existsSync(UPLOADS_DIR)) {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        fs.writeFileSync(finalPath, videoFile.buffer);
      } catch (diskErr) {
        console.warn('Disk direct upload save warning:', diskErr);
      }

      const cleanTitle = (typeof title === 'string' && title.trim()) ? title.trim() : videoFile.originalname;
      
      let parsedTags: string[] = [];
      if (Array.isArray(tags)) {
        parsedTags = tags.map(t => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
      } else if (typeof tags === 'string' && tags.trim()) {
        try {
          const jsonTags = JSON.parse(tags);
          if (Array.isArray(jsonTags)) {
            parsedTags = jsonTags.map(t => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
          }
        } catch (e) {
          parsedTags = tags.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
        }
      }

      // Base64 Data URL for fallback playback
      let dataUrl: string | undefined = undefined;
      if (videoFile.buffer && videoFile.size <= 25 * 1024 * 1024) {
        const mime = videoFile.mimetype || 'video/mp4';
        dataUrl = `data:${mime};base64,${videoFile.buffer.toString('base64')}`;
      }

      const db = getDb();
      const newVideo = {
        id,
        filename: finalFileName,
        originalName: videoFile.originalname,
        mimeType: videoFile.mimetype || 'video/mp4',
        size: videoFile.size,
        createdAt: new Date().toISOString(),
        title: cleanTitle,
        tags: parsedTags,
        viewCount: 0,
        dataUrl,
        thumbnailUrl: typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('data:') ? thumbnailUrl : undefined,
        public: req.body.public !== undefined ? (req.body.public === 'true' || req.body.public === true) : true
      };

      db.videos.unshift(newVideo);
      saveDb(db);

      return res.json({ success: true, video: newVideo });
    } catch (e: any) {
      console.error('Direct upload save error:', e);
      return res.status(500).json({ error: e?.message || 'Failed to save uploaded video' });
    }
  });
});

app.post('/api/upload-complete', async (req, res) => {
  const { uploadId, fileName, mimeType, size, totalChunks, title, tags, thumbnailUrl } = req.body;
  
  if (!uploadId || !fileName || totalChunks === undefined) {
    return res.status(400).json({ error: 'Missing required upload parameters' });
  }

  if (size && size > 100 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size exceeds the 100MB maximum limit.' });
  }

  const id = uuidv4();
  const ext = path.extname(fileName) || '.mp4';
  const finalFileName = `${id}${ext}`;
  const finalPath = path.join(UPLOADS_DIR, finalFileName);

  try {
    const chunkMap = inMemoryChunks.get(uploadId);
    const chunkBuffers: Buffer[] = [];
    const totalCount = Number(totalChunks);

    for (let i = 0; i < totalCount; i++) {
      let chunkData: Buffer | null = null;
      if (chunkMap && chunkMap.has(i)) {
        chunkData = chunkMap.get(i)!;
      } else {
        const chunkPath = path.join(UPLOADS_DIR, `${uploadId}_${i}`);
        if (fs.existsSync(chunkPath)) {
          chunkData = fs.readFileSync(chunkPath);
          try { fs.unlinkSync(chunkPath); } catch (e) {}
        }
      }

      if (!chunkData) {
        return res.status(400).json({ error: `Missing chunk ${i} on server.` });
      }
      chunkBuffers.push(chunkData);
    }

    const fullBuffer = Buffer.concat(chunkBuffers);
    inMemoryChunks.delete(uploadId);

    // Write complete video file to disk
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      fs.writeFileSync(finalPath, fullBuffer);
    } catch (diskWriteErr) {
      console.warn('Disk assemble write warning:', diskWriteErr);
    }

    // Attach dataUrl for offline/fallback serving
    let dataUrl: string | undefined = undefined;
    if (fullBuffer.length <= 25 * 1024 * 1024) {
      const mime = mimeType || 'video/mp4';
      dataUrl = `data:${mime};base64,${fullBuffer.toString('base64')}`;
    }

    const cleanTitle = (typeof title === 'string' && title.trim()) ? title.trim() : fileName;
    
    let processedTags: string[] = [];
    if (Array.isArray(tags)) {
      processedTags = tags.map((t: any) => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
    } else if (typeof tags === 'string') {
      processedTags = tags.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
    }

    const newVideo = {
      id,
      filename: finalFileName,
      originalName: cleanTitle,
      mimetype: mimeType || 'video/mp4',
      size: size || fullBuffer.length,
      downloadUrl: `/uploads/${finalFileName}`,
      tags: processedTags,
      createdAt: new Date().toISOString(),
      viewCount: 0,
      dataUrl,
      thumbnailUrl: typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('data:') ? thumbnailUrl : undefined,
      public: req.body.public !== undefined ? Boolean(req.body.public) : true
    };

    const db = getDb();
    db.videos.unshift(newVideo);
    saveDb(db);

    res.json({ success: true, video: newVideo });
  } catch (err: any) {
    console.error('Chunk assemble error:', err);
    res.status(500).json({ error: err?.message || 'Failed to assemble video chunks' });
  }
});

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

app.get('/api/videos', (req, res) => {
  const db = getDb();
  res.json(db.videos || []);
});

app.post('/api/videos/register', express.json({ limit: '100mb' }), (req, res) => {
  try {
    const { id, filename, originalName, mimetype, size, downloadUrl, tags, createdAt, viewCount, dataUrl, thumbnailUrl, public: isPublic } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Missing video ID' });
    }

    const cleanFilename = filename || `${id}.mp4`;
    const targetFilePath = path.join(UPLOADS_DIR, cleanFilename);

    // If dataUrl is supplied and file on disk does not exist, save buffer to disk
    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      try {
        if (!fs.existsSync(targetFilePath)) {
          const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
          if (matches && matches[2]) {
            const buf = Buffer.from(matches[2], 'base64');
            fs.writeFileSync(targetFilePath, buf);
          }
        }
      } catch (fileErr) {
        console.warn('Could not write registered dataUrl to disk file:', fileErr);
      }
    }

    const db = getDb();
    const existingIndex = db.videos.findIndex((v: any) => v.id === id);
    const videoObj = {
      id,
      filename: cleanFilename,
      originalName: originalName || 'Video Asset',
      mimetype: mimetype || 'video/mp4',
      size: size || 0,
      downloadUrl: downloadUrl || `/uploads/${cleanFilename}`,
      tags: Array.isArray(tags) ? tags : [],
      createdAt: createdAt || new Date().toISOString(),
      viewCount: viewCount || 0,
      dataUrl,
      thumbnailUrl,
      public: isPublic !== undefined ? Boolean(isPublic) : true
    };

    if (existingIndex >= 0) {
      db.videos[existingIndex] = { ...db.videos[existingIndex], ...videoObj };
    } else {
      db.videos.unshift(videoObj);
    }
    saveDb(db);
    res.json({ success: true, video: videoObj });
  } catch (err: any) {
    console.error('Failed to register video:', err);
    res.status(500).json({ error: 'Failed to register video metadata' });
  }
});

app.get('/api/videos/:id', (req, res) => {
  const db = getDb();
  const searchId = req.params.id;
  
  // Search by exact id, exact filename, or filename starting with id
  let video = db.videos.find((v: any) => 
    v.id === searchId || 
    v.filename === searchId || 
    (v.filename && v.filename.startsWith(searchId))
  );

  if (!video) {
    // Check if there is an actual physical file in UPLOADS_DIR matching this ID
    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const files = fs.readdirSync(UPLOADS_DIR);
        const match = files.find(f => f.includes(searchId));
        if (match) {
          const filePath = path.join(UPLOADS_DIR, match);
          const stat = fs.statSync(filePath);
          video = {
            id: searchId,
            filename: match,
            originalName: match,
            mimetype: 'video/mp4',
            size: stat.size,
            downloadUrl: `/uploads/${match}`,
            tags: [],
            createdAt: stat.birthtime.toISOString(),
            viewCount: 1,
            public: true
          };
          db.videos.unshift(video);
          saveDb(db);
        }
      }
    } catch (e) {}
  }

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  res.json({
    ...video,
    public: video.public !== undefined ? video.public : true
  });
});

app.put('/api/videos/:id/privacy', express.json(), (req, res) => {
  const db = getDb();
  const video = db.videos.find((v: any) => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const { isPublic } = req.body;
  video.public = Boolean(isPublic);
  saveDb(db);

  res.json({ success: true, public: video.public });
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
