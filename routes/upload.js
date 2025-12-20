import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage (Cloudinary needs buffer)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images with specific MIME types
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
    }
  },
});

// Upload image to Cloudinary
router.post('/image', verifyToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Additional security: Verify file is actually an image by checking magic numbers
    const allowedSignatures = [
      [0xFF, 0xD8, 0xFF], // JPEG
      [0x89, 0x50, 0x4E, 0x47], // PNG
      [0x47, 0x49, 0x46, 0x38], // GIF
    ];
    
    const fileSignature = Array.from(req.file.buffer.slice(0, 4));
    const isValidImage = allowedSignatures.some(sig => 
      sig.every((byte, index) => fileSignature[index] === byte)
    );

    if (!isValidImage) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image file. File content does not match image format.'
      });
    }

    // Convert buffer to base64 for Cloudinary
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'coffee-arts-paris/products',
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
      ],
    });

    res.json({
      success: true,
      data: {
        url: result.secure_url,
        public_id: result.public_id,
      }
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

