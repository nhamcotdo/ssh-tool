import sharp from 'sharp';
import fs from 'fs';

const size = 1024;
const svgBuffer = fs.readFileSync('./public/icon.svg');

sharp(svgBuffer)
  .resize(size, size)
  .png()
  .toFile('./build/icon.png')
  .then(() => {
    console.log('Icon generated at build/icon.png');
  })
  .catch(err => {
    console.error(err);
  });
