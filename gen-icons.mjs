import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logo = path.join(__dirname, 'public', 'Logo nagelstylist.png');
const pub  = path.join(__dirname, 'public');

for (const size of [192, 512]) {
  // Wit vierkant achtergrond + logo gecentreerd met padding
  const padding = Math.round(size * 0.12);
  const inner   = size - padding * 2;

  await sharp(logo)
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer()
    .then(logoResized =>
      sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } } })
        .composite([{ input: logoResized, gravity: 'centre' }])
        .png()
        .toFile(path.join(pub, `pwa-${size}x${size}.png`))
    );

  console.log(`✓ pwa-${size}x${size}.png`);
}
