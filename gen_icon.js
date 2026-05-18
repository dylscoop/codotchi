// Generates vscode/media/icon_128.png — egg sprite, 128x128
// Pure Node.js, no external dependencies.
// Geometry mirrors icon.svg (16x16 viewBox) scaled by 8x.

const zlib = require('zlib');
const fs   = require('fs');

const W = 128, H = 128;

// RGBA pixel buffer
const buf = Buffer.alloc(W * H * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i]   = r;
  buf[i+1] = g;
  buf[i+2] = b;
  buf[i+3] = a;
}

// Fill background: #1e1e1e
buf.fill(0);
for (let i = 0; i < W * H; i++) {
  buf[i*4]   = 0x1e;
  buf[i*4+1] = 0x1e;
  buf[i*4+2] = 0x1e;
  buf[i*4+3] = 255;
}

// Scale factor: 8 (16→128)
const S = 8;

// Ellipse: cx=8,cy=9,rx=5,ry=6  scaled → cx=64,cy=72,rx=40,ry=48
// Draw filled ellipse
const ECX = 64, ECY = 72, ERX = 40, ERY = 48;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - ECX) / ERX;
    const dy = (y - ECY) / ERY;
    if (dx*dx + dy*dy <= 1.0) {
      setPixel(x, y, 255, 255, 255);
    }
  }
}

// Eyes (cut out with background colour #1e1e1e)
// Left eye: cx=6,cy=8,r=1  → cx=48,cy=64,r=8
// Right eye: cx=10,cy=8,r=1 → cx=80,cy=64,r=8
const eyes = [{cx:48,cy:64},{cx:80,cy:64}];
for (const {cx,cy} of eyes) {
  const R = 8;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx*dx + dy*dy <= R*R) {
        setPixel(x, y, 0x1e, 0x1e, 0x1e);
      }
    }
  }
}

// Mouth: rect x=7,y=11,w=2,h=1  → x=56,y=88,w=16,h=8
for (let y = 88; y < 96; y++) {
  for (let x = 56; x < 72; x++) {
    setPixel(x, y, 0x1e, 0x1e, 0x1e);
  }
}

// Feet (white): rect x=5,y=15,w=2,h=1 and x=9,y=15,w=2,h=1
// → x=40,y=120,w=16,h=8  and x=72,y=120,w=16,h=8
for (let y = 120; y < 128; y++) {
  for (let x = 40; x < 56; x++) setPixel(x, y, 255, 255, 255);
  for (let x = 72; x < 88; x++) setPixel(x, y, 255, 255, 255);
}

// --- PNG encoding ---

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })());
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 2;   // color type: RGB (no alpha, but we'll use RGBA=6 for safety)
ihdr[9] = 6;   // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// Raw image data: filter byte 0 per scanline
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W*4)] = 0; // filter: None
  buf.copy(raw, y*(1+W*4)+1, y*W*4, (y+1)*W*4);
}

const compressed = zlib.deflateSync(raw, {level: 9});

const png = Buffer.concat([
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), // PNG sig
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync('vscode/media/icon_128.png', png);
console.log('Written vscode/media/icon_128.png (' + png.length + ' bytes)');
