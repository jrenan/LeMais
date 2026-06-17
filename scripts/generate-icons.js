const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const outDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(outDir, { recursive: true });

const colors = {
  teal: [15, 118, 110, 255],
  white: [255, 255, 255, 255],
  whiteSoft: [255, 255, 255, 46],
  orange: [198, 95, 43, 255]
};

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function png(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    rows[rowStart] = 0;
    rgba.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function drawIcon(size, fileName, maskable = false) {
  const scale = size / 512;
  const pixels = Buffer.alloc(size * size * 4, 0);

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (Math.floor(y) * size + Math.floor(x)) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }

  function roundedRect(x, y, width, height, radius, color) {
    const sx = Math.round(x * scale);
    const sy = Math.round(y * scale);
    const sw = Math.round(width * scale);
    const sh = Math.round(height * scale);
    const sr = Math.round(radius * scale);
    for (let py = sy; py < sy + sh; py += 1) {
      for (let px = sx; px < sx + sw; px += 1) {
        const cx = px < sx + sr ? sx + sr : px >= sx + sw - sr ? sx + sw - sr - 1 : px;
        const cy = py < sy + sr ? sy + sr : py >= sy + sh - sr ? sy + sh - sr - 1 : py;
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= sr * sr || (px === cx && py === cy)) setPixel(px, py, color);
      }
    }
  }

  function rect(x, y, width, height, color) {
    const sx = Math.round(x * scale);
    const sy = Math.round(y * scale);
    const sw = Math.round(width * scale);
    const sh = Math.round(height * scale);
    for (let py = sy; py < sy + sh; py += 1) {
      for (let px = sx; px < sx + sw; px += 1) setPixel(px, py, color);
    }
  }

  function line(x, y, width, height, color) {
    roundedRect(x, y, width, height, height / 2, color);
  }

  roundedRect(0, 0, 512, 512, maskable ? 0 : 112, colors.teal);
  roundedRect(116, 60, 278, 392, 66, colors.whiteSoft);
  roundedRect(105, 104, 284, 348, 53, colors.white);
  line(208, 213, 112, 31, colors.teal);
  line(208, 270, 112, 31, colors.teal);
  line(208, 327, 70, 31, colors.teal);
  roundedRect(360, 44, 96, 133, 26, colors.orange);
  rect(384, 135, 48, 58, colors.teal);

  fs.writeFileSync(path.join(outDir, fileName), png(size, size, pixels));
}

drawIcon(180, "apple-touch-icon.png");
drawIcon(192, "icon-192.png");
drawIcon(512, "icon-512.png");
drawIcon(512, "maskable-512.png", true);

console.log("Generated PWA icons.");
