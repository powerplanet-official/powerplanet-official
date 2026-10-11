import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { get, put } from './db.mjs';

// Keep uploads with the persistent backend database, never Vercel's filesystem.
export async function uploadProductImage(req, res) {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ error: 'Choose a JPG, PNG or WebP image.' });
  }
  let bytes;
  try {
    const image = sharp(req.body, { limitInputPixels: 40000000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
      return res.status(400).json({ error: 'Choose a non-animated JPG, PNG or WebP image.' });
    }
    // Decode and re-encode so renamed files and embedded metadata are not served.
    bytes = await image
      .rotate()
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return res
      .status(400)
      .json({ error: 'This image could not be read. Choose a valid JPG, PNG or WebP file.' });
  }
  const id = createHash('sha256').update(bytes).digest('hex');
  put('product-images', { id, data: bytes.toString('base64') });
  res.status(201).json({ image: `/api/product-images/${id}.webp` });
}

export function serveProductImage(req, res) {
  const match = /^([a-f0-9]{64})\.webp$/.exec(req.params.filename);
  const saved = match && get('product-images', match[1]);
  if (!saved) return res.status(404).json({ error: 'Image not found' });
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('image/webp').send(Buffer.from(saved.data, 'base64'));
}
