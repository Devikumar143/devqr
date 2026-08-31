const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([lenBuf, body, crcBuf]);
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineSize;
    rawData[rowOffset] = 0; // Filter: None
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(rawData, rowOffset + 1, srcOffset, srcOffset + width * 4);
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function drawDevQRIcon(width, height, isSplash = false) {
  const buffer = Buffer.alloc(width * height * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
    if (a >= 255) {
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255;
    } else {
      const alpha = a / 255;
      const invAlpha = 1 - alpha;
      buffer[idx] = Math.round(r * alpha + buffer[idx] * invAlpha);
      buffer[idx + 1] = Math.round(g * alpha + buffer[idx + 1] * invAlpha);
      buffer[idx + 2] = Math.round(b * alpha + buffer[idx + 2] * invAlpha);
      buffer[idx + 3] = Math.min(255, Math.round(a + buffer[idx + 3] * invAlpha));
    }
  }

  // Fill Background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isSplash) {
        // Deep modern dark background for splash
        setPixel(x, y, 9, 13, 22, 255); // #090d16
      } else {
        // Clean deep obsidian rounded background
        setPixel(x, y, 9, 13, 22, 255);
      }
    }
  }

  // Center & scaling
  const cx = width / 2;
  const cy = height / 2;
  const scale = width / 100; // Normalizing to 100x100 grid

  function fillRoundedRect(x1, y1, w, h, radius, r, g, b, a = 255) {
    for (let py = y1; py <= y1 + h; py++) {
      for (let px = x1; px <= x1 + w; px++) {
        let inside = false;
        const rx = Math.min(px - x1, x1 + w - px);
        const ry = Math.min(py - y1, y1 + h - py);
        if (rx >= radius || ry >= radius) {
          inside = true;
        } else {
          const dx = radius - rx;
          const dy = radius - ry;
          if (dx * dx + dy * dy <= radius * radius) {
            inside = true;
          }
        }
        if (inside) {
          setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  function strokeRoundedRect(x1, y1, w, h, radius, strokeWidth, r, g, b, a = 255) {
    for (let py = y1 - strokeWidth; py <= y1 + h + strokeWidth; py++) {
      for (let px = x1 - strokeWidth; px <= x1 + w + strokeWidth; px++) {
        // Outer check
        let inOuter = false;
        const rxO = Math.min(px - (x1 - strokeWidth), (x1 + w + strokeWidth) - px);
        const ryO = Math.min(py - (y1 - strokeWidth), (y1 + h + strokeWidth) - py);
        const radO = radius + strokeWidth;
        if (rxO >= radO || ryO >= radO) inOuter = true;
        else if ((radO - rxO) * (radO - rxO) + (radO - ryO) * (radO - ryO) <= radO * radO) inOuter = true;

        // Inner check
        let inInner = false;
        const rxI = Math.min(px - (x1 + strokeWidth), (x1 + w - strokeWidth) - px);
        const ryI = Math.min(py - (y1 + strokeWidth), (y1 + h - strokeWidth) - py);
        const radI = Math.max(0, radius - strokeWidth);
        if (rxI >= 0 && ryI >= 0) {
          if (rxI >= radI || ryI >= radI) inInner = true;
          else if ((radI - rxI) * (radI - rxI) + (radI - ryI) * (radI - ryI) <= radI * radI) inInner = true;
        }

        if (inOuter && !inInner) {
          setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  function drawThickLine(x1, y1, x2, y2, strokeW, r, g, b, a = 255) {
    const steps = Math.hypot(x2 - x1, y2 - y1) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lx = x1 + (x2 - x1) * t;
      const ly = y1 + (y2 - y1) * t;
      for (let ox = -strokeW; ox <= strokeW; ox++) {
        for (let oy = -strokeW; oy <= strokeW; oy++) {
          if (ox * ox + oy * oy <= strokeW * strokeW) {
            setPixel(lx + ox, ly + oy, r, g, b, a);
          }
        }
      }
    }
  }

  // Draw main emblem card
  const badgeSize = 80 * scale;
  const badgeX = cx - badgeSize / 2;
  const badgeY = cy - badgeSize / 2;
  const badgeRadius = 20 * scale;
  const strokeSize = 2.5 * scale;

  // Outer Neon Glow / Stroke
  strokeRoundedRect(badgeX, badgeY, badgeSize, badgeSize, badgeRadius, strokeSize * 1.5, 0, 240, 255, 60);
  strokeRoundedRect(badgeX, badgeY, badgeSize, badgeSize, badgeRadius, strokeSize, 2, 132, 199, 255);

  // QR Finders (Top-Left, Top-Right, Bottom-Left)
  const qrBoxSize = 16 * scale;
  const qrInnerSize = 6.5 * scale;
  const qrRadius = 4 * scale;
  const qrStroke = 2.2 * scale;

  // 1. Top-Left QR Finder
  const q1X = badgeX + 10 * scale;
  const q1Y = badgeY + 10 * scale;
  strokeRoundedRect(q1X, q1Y, qrBoxSize, qrBoxSize, qrRadius, qrStroke, 0, 240, 255, 255);
  fillRoundedRect(q1X + (qrBoxSize - qrInnerSize) / 2, q1Y + (qrBoxSize - qrInnerSize) / 2, qrInnerSize, qrInnerSize, 2 * scale, 0, 240, 255, 255);

  // 2. Top-Right QR Finder
  const q2X = badgeX + badgeSize - 10 * scale - qrBoxSize;
  const q2Y = badgeY + 10 * scale;
  strokeRoundedRect(q2X, q2Y, qrBoxSize, qrBoxSize, qrRadius, qrStroke, 56, 189, 248, 255);
  fillRoundedRect(q2X + (qrBoxSize - qrInnerSize) / 2, q2Y + (qrBoxSize - qrInnerSize) / 2, qrInnerSize, qrInnerSize, 2 * scale, 56, 189, 248, 255);

  // 3. Bottom-Left QR Finder
  const q3X = badgeX + 10 * scale;
  const q3Y = badgeY + badgeSize - 10 * scale - qrBoxSize;
  strokeRoundedRect(q3X, q3Y, qrBoxSize, qrBoxSize, qrRadius, qrStroke, 56, 189, 248, 255);
  fillRoundedRect(q3X + (qrBoxSize - qrInnerSize) / 2, q3Y + (qrBoxSize - qrInnerSize) / 2, qrInnerSize, qrInnerSize, 2 * scale, 56, 189, 248, 255);

  // 4. Bottom-Right Data Accent Matrix
  const q4X = badgeX + badgeSize - 10 * scale - qrBoxSize;
  const q4Y = badgeY + badgeSize - 10 * scale - qrBoxSize;
  fillRoundedRect(q4X, q4Y, 6 * scale, 6 * scale, 1.5 * scale, 99, 102, 241, 255);
  fillRoundedRect(q4X + 9 * scale, q4Y, 6 * scale, 6 * scale, 1.5 * scale, 56, 189, 248, 255);
  fillRoundedRect(q4X, q4Y + 9 * scale, 6 * scale, 6 * scale, 1.5 * scale, 0, 240, 255, 255);
  fillRoundedRect(q4X + 9 * scale, q4Y + 9 * scale, 6 * scale, 6 * scale, 3 * scale, 168, 85, 247, 255);

  // Center Developer `< / >` Chevron + Energy Spark
  const chevW = 3.2 * scale;
  // '<'
  drawThickLine(cx - 10 * scale, cy - 7 * scale, cx - 17 * scale, cy, chevW, 0, 240, 255, 255);
  drawThickLine(cx - 17 * scale, cy, cx - 10 * scale, cy + 7 * scale, chevW, 0, 240, 255, 255);

  // '>'
  drawThickLine(cx + 10 * scale, cy - 7 * scale, cx + 17 * scale, cy, chevW, 99, 102, 241, 255);
  drawThickLine(cx + 17 * scale, cy, cx + 10 * scale, cy + 7 * scale, chevW, 99, 102, 241, 255);

  // '/' Slash / Spark
  drawThickLine(cx + 4 * scale, cy - 10 * scale, cx - 4 * scale, cy + 10 * scale, chevW, 2, 132, 199, 255);

  // Center Glowing Neural Node
  fillRoundedRect(cx - 3.5 * scale, cy - 3.5 * scale, 7 * scale, 7 * scale, 3.5 * scale, 255, 255, 255, 255);
  fillRoundedRect(cx - 1.8 * scale, cy - 1.8 * scale, 3.6 * scale, 3.6 * scale, 1.8 * scale, 0, 240, 255, 255);

  return encodePNG(width, height, buffer);
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('Generating 1024x1024 high-res DevQR icon...');
const iconPng = drawDevQRIcon(1024, 1024, false);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPng);

console.log('Generating 1024x1024 adaptive-icon...');
const adaptivePng = drawDevQRIcon(1024, 1024, false);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptivePng);

console.log('Generating 1024x1024 splash screen...');
const splashPng = drawDevQRIcon(1024, 1024, true);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashPng);

console.log('All DevQR brand assets generated successfully!');
