const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'rotfrrrt',
  api_key: '367347282362872',
  api_secret: 'bJJlXy84e1Td-YRSxy7-Mhkm2n8'
});

async function test() {
  try {
    const fs = require('fs');
    fs.writeFileSync('test.txt', 'hello world');
    const result = await cloudinary.uploader.upload('test.txt', { resource_type: 'auto' });
    console.log('Success:', result.secure_url);
  } catch(e) {
    console.error('Error:', e);
  }
}
test();
