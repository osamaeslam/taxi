import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const srcImg = './src/assets/images/captain_ezz_icon_1789927664216.jpg';
const outDir = './public';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('Generating PWA icons from:', srcImg);

  // 1. Standard 192x192 PNG
  await sharp(srcImg)
    .resize(192, 192, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(outDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  // 2. Standard 512x512 PNG
  await sharp(srcImg)
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(outDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  // 3. Apple Touch Icon 180x180 PNG
  await sharp(srcImg)
    .resize(180, 180, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 4. Favicon 64x64 PNG & 32x32
  await sharp(srcImg)
    .resize(64, 64, { fit: 'cover' })
    .png({ quality: 90 })
    .toFile(path.join(outDir, 'favicon.png'));
  console.log('Created favicon.png');

  await sharp(srcImg)
    .resize(32, 32, { fit: 'cover' })
    .png({ quality: 90 })
    .toFile(path.join(outDir, 'favicon.ico'));
  console.log('Created favicon.ico');

  // 5. Maskable Icons (Must have 10-15% safe-zone margin on all sides)
  // We place a 410x410 resized icon in the center of a 512x512 canvas with brand background #0a5243
  const inner512 = await sharp(srcImg)
    .resize(410, 410, { fit: 'cover' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 10, g: 82, b: 67, alpha: 1 }
    }
  })
    .composite([{ input: inner512, gravity: 'center' }])
    .png({ quality: 95 })
    .toFile(path.join(outDir, 'icon-maskable-512.png'));
  console.log('Created icon-maskable-512.png');

  const inner192 = await sharp(srcImg)
    .resize(154, 154, { fit: 'cover' })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 10, g: 82, b: 67, alpha: 1 }
    }
  })
    .composite([{ input: inner192, gravity: 'center' }])
    .png({ quality: 95 })
    .toFile(path.join(outDir, 'icon-maskable-192.png'));
  console.log('Created icon-maskable-192.png');

  console.log('All PWA icons successfully generated!');
}

run().catch(console.error);
