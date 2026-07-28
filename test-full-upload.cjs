const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
  const uploadId = 'test_upload_' + Date.now();
  const chunk = Buffer.from('dummy video content for cloudinary testing...');
  
  // 1. Upload chunk
  const form = new FormData();
  form.append('chunk', chunk, 'chunk.bin');
  form.append('uploadId', uploadId);
  form.append('chunkIndex', '0');
  
  let res = await fetch('http://localhost:3000/api/upload-chunk', { method: 'POST', body: form });
  console.log('Chunk response:', res.status, await res.text());
  
  // 2. Complete upload
  res = await fetch('http://localhost:3000/api/upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      fileName: 'test.mp4',
      mimeType: 'video/mp4',
      size: chunk.length,
      totalChunks: 1
    })
  });
  console.log('Complete response:', res.status, await res.text());
}
test().catch(console.error);
