const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

// Configure storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'quickquote_videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
    max_file_size: 100 * 1024 * 1024, // 100MB max file size
    transformation: [
      { width: 1280, height: 720, crop: 'limit', quality: 'auto' }
    ],
    public_id: (req, file) => {
      // Use the quote ID as part of the filename for easy reference
      const quoteId = req.body.quoteId || 'unknown';
      return `${quoteId}_${Date.now()}`;
    }
  }
});

// Configure multer for video uploads
const videoUpload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

module.exports = {
  cloudinary,
  videoUpload
};
