import fetch from 'node-fetch';
import FormData from 'form-data';

async function run() {
  let form = new FormData();
  form.append('chunk', Buffer.from('test'), 'chunk.bin');
  form.append('uploadId', 'test1234');
  form.append('chunkIndex', '0');
  await fetch('http://localhost:3000/api/upload-chunk', { method: 'POST', body: form });
  
  let res = await fetch('http://localhost:3000/api/upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId: 'test1234', fileName: 'test.mp4', mimeType: 'video/mp4', size: 4, totalChunks: 1 })
  });
  let json = await res.json();
  console.log(json);
}
run();
