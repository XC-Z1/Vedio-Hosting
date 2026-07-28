import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = 3000;
const UPLOADS_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads');
const DB_FILE = process.env.VERCEL ? path.join('/tmp', 'db.json') : path.join(process.cwd(), 'db.json');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Simple JSON database for metadata
const getDb = () => {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      return { videos: [] };
    }
  }
  return { videos: [] };
};

const saveDb = (data: any) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Multer setup for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } }); // 1GB max

app.use(express.json());
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
  const { uploadId, fileName, mimeType, size, totalChunks } = req.body;
  
  if (!uploadId || !fileName || totalChunks === undefined) {
    return res.status(400).json({ error: 'Missing required data' });
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
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      writeStream.end();
    });
    
    let downloadUrl = null;
    
    // Upload to Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      console.log('Uploading to Cloudinary...');
      try {
        const result = await cloudinary.uploader.upload_large(finalPath, {
          resource_type: 'video',
          folder: 'video_uploads'
        });
        downloadUrl = result.secure_url;
        // Delete the local temporary file
        fs.unlinkSync(finalPath);
      } catch (error: any) {
        fs.appendFileSync('cloudinary_error.log', JSON.stringify(error, null, 2) + '\\n');
        console.error('Cloudinary upload error:', error);
      }
    }

    const newVideo = {
      id,
      filename: finalFileName,
      originalName: fileName,
      mimetype: mimeType,
      size,
      downloadUrl,
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

app.get('/api/videos/:id', (req, res) => {
  const db = getDb();
  const video = db.videos.find((v: any) => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  // Increment view count
  video.viewCount = (video.viewCount || 0) + 1;
  saveDb(db);
  
  res.json(video);
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

// Vite Integration for full-stack React serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
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
