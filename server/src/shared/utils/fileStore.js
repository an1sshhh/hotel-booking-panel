const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../loggers/logger');
const { ApiError } = require('../../core/ApiError');

/*
 * Where uploaded images live.
 *  - Supabase Storage (public bucket) when SUPABASE_URL + SUPABASE_SECRET_KEY are set —
 *    required when hosted: hosts like Render wipe the local disk on every deploy.
 *  - Otherwise the local uploads/ folder (served at /uploads), for development.
 * The database stores the full public URL for Supabase files and /uploads/<name> locally.
 */

const LOCAL_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

// Checked against the file's first bytes, so a renamed .html/.svg can't pass as an image.
const SIGNATURES = {
  'image/jpeg': { ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/gif': { ext: '.gif', test: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8' },
  'image/webp': { ext: '.webp', test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
};

const supabase = () => config.storage.supabaseUrl && config.storage.supabaseKey;
const storageBase = () => `${config.storage.supabaseUrl.replace(/\/$/, '')}/storage/v1`;
const publicPrefix = () => `${storageBase()}/object/public/${config.storage.bucket}/`;

async function storageFetch(pathAndQuery, init = {}) {
  const res = await fetch(`${storageBase()}${pathAndQuery}`, {
    ...init,
    headers: { apikey: config.storage.supabaseKey, Authorization: `Bearer ${config.storage.supabaseKey}`, ...init.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Supabase Storage ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

/** Creates the public images bucket on first use (idempotent). */
let bucketReady = null;
function ensureBucket() {
  bucketReady ??= (async () => {
    try {
      await storageFetch(`/bucket/${config.storage.bucket}`);
    } catch (err) {
      if (err.status !== 404 && err.status !== 400) throw err;
      await storageFetch('/bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: config.storage.bucket, name: config.storage.bucket, public: true,
          file_size_limit: 5 * 1024 * 1024, allowed_mime_types: Object.keys(SIGNATURES),
        }),
      });
      logger.info(`Created public Supabase Storage bucket "${config.storage.bucket}"`);
    }
  })().catch((err) => {
    bucketReady = null; // retry on the next upload
    throw err;
  });
  return bucketReady;
}

/** Validates an uploaded image (multer memory file) and stores it. Returns the URL to save in the DB. */
async function saveUpload(file, folder = 'images') {
  if (!file?.buffer?.length) throw ApiError.badRequest('Image file is required');
  const sig = SIGNATURES[file.mimetype];
  if (!sig || !sig.test(file.buffer)) throw ApiError.badRequest('Only JPEG, PNG, WEBP or GIF images are allowed');
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${sig.ext}`;

  if (!supabase()) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, name), file.buffer);
    return `/uploads/${name}`;
  }
  try {
    await ensureBucket();
    const key = `${folder}/${name}`;
    await storageFetch(`/object/${config.storage.bucket}/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': file.mimetype, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
      body: file.buffer,
    });
    return publicPrefix() + key;
  } catch (err) {
    logger.error(`Image upload failed: ${err.message}`);
    throw ApiError.unavailable('Image storage is unavailable right now — please try again.', 502);
  }
}

/** Deletes a stored image. Never throws: a missing file must not block deleting its record. */
async function removeUpload(url) {
  if (!url) return;
  try {
    if (supabase() && url.startsWith(publicPrefix())) {
      const key = url.slice(publicPrefix().length);
      await storageFetch(`/object/${config.storage.bucket}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [key] }),
      });
    } else if (url.startsWith('/uploads/')) {
      await fs.unlink(path.join(LOCAL_DIR, path.basename(url)));
    }
  } catch (err) {
    logger.warn(`Could not delete stored image ${url}: ${err.message}`);
  }
}

module.exports = { saveUpload, removeUpload, LOCAL_DIR };
