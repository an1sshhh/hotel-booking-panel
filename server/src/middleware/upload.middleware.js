const multer = require('multer');

// Files are kept in memory and handed to shared/utils/fileStore, which checks the
// real file bytes and stores them (Supabase Storage when hosted, local disk in dev).
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, WEBP or GIF images are allowed'));
  }
  cb(null, true);
}

const upload = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

module.exports = { upload };
