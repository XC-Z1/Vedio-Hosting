const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');

const app = express();
const upload = multer({ dest: '/tmp' });

app.post('/upload', upload.single('chunk'), (req, res) => {
  res.json({ file: !!req.file, body: req.body });
});

app.listen(3001, async () => {
  console.log('Server started');
  const form = new FormData();
  form.append('chunk', Buffer.from('hello world'));
  form.append('uploadId', 'test');
  
  const res = await fetch('http://localhost:3001/upload', {
    method: 'POST',
    body: form
  });
  console.log(await res.json());
  
  const form2 = new FormData();
  form2.append('chunk', Buffer.from('hello world'), 'chunk.bin');
  form2.append('uploadId', 'test');
  
  const res2 = await fetch('http://localhost:3001/upload', {
    method: 'POST',
    body: form2
  });
  console.log(await res2.json());
  process.exit(0);
});
