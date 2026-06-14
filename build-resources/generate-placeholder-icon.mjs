// Generates placeholder app icons for Electron packaging:
//   build-resources/icon.ico  (256x256, embedded PNG — Windows / electron-builder)
//   build-resources/icon.png  (256x256 — Linux)
// Replace these with the real branded artwork before a production release.
//
// Run: node build-resources/generate-placeholder-icon.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SIZE = 256;
const here = path.dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Build RGBA pixels: vertical cyan→blue gradient (matches the app accent).
function buildPng() {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0; // filter: none
    const t = y / (SIZE - 1);
    const r = Math.round(0x06 + t * (0x1d - 0x06));
    const g = Math.round(0xb6 + t * (0x4e - 0xb6));
    const b = Math.round(0xd4 + t * (0xd8 - 0xd4));
    for (let x = 0; x < SIZE; x++) {
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = 0xff;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildIco(png) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 0 => 256
  entry[1] = 0; // height 0 => 256
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8); // size
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([dir, entry, png]);
}

const png = buildPng();
writeFileSync(path.join(here, "icon.png"), png);
writeFileSync(path.join(here, "icon.ico"), buildIco(png));
console.log(`Wrote icon.png (${png.length}b) and icon.ico (${png.length + 22}b) at 256x256`);
