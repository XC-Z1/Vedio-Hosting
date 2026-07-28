require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

cloudinary.uploader.upload('mov_bbb.mp4', {
  resource_type: 'video',
  folder: 'video_uploads'
}, function(error, result) {
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("SUCCESS:", result);
  }
});
