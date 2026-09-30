import fs from 'node:fs';
import zlib from 'node:zlib';

/** RGBA image, 8 bits per channel. */
export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

export function createImage(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function readPng(file: string): Rgba {
  const buf = fs.readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const chunk = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8]!;
      colorType = chunk[9]!;
    } else if (type === 'PLTE') palette = chunk;
    else if (type === 'tRNS') trns = chunk;
    else if (type === 'IDAT') idat.push(chunk);
    offset += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`${file}: bit depth ${bitDepth} unsupported`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`${file}: color type ${colorType} unsupported`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x += 1) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= channels ? pixels[y * stride + x - channels]! : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels]! : 0;
      let out = v;
      if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      pixels[y * stride + x] = out & 0xff;
    }
  }
  const img = createImage(width, height);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    if (colorType === 6) img.data.set(pixels.subarray(i * 4, i * 4 + 4), o);
    else if (colorType === 2) img.data.set([pixels[i * 3]!, pixels[i * 3 + 1]!, pixels[i * 3 + 2]!, 255], o);
    else if (colorType === 4) img.data.set([pixels[i * 2]!, pixels[i * 2]!, pixels[i * 2]!, pixels[i * 2 + 1]!], o);
    else if (colorType === 0) img.data.set([pixels[i]!, pixels[i]!, pixels[i]!, 255], o);
    else {
      const p = pixels[i]!;
      img.data.set([palette![p * 3]!, palette![p * 3 + 1]!, palette![p * 3 + 2]!, trns && p < trns.length ? trns[p]! : 255], o);
    }
  }
  return img;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function writePng(file: string, img: Rgba): void {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = img.width * 4;
  const raw = Buffer.alloc((stride + 1) * img.height);
  for (let y = 0; y < img.height; y += 1) {
    Buffer.from(img.data.buffer, img.data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

export function getPixel(img: Rgba, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return -1;
  const o = (y * img.width + x) * 4;
  if (img.data[o + 3]! === 0) return -1;
  return (img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!;
}

export function setPixel(img: Rgba, x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const o = (y * img.width + x) * 4;
  if (color < 0) {
    img.data.set([0, 0, 0, 0], o);
    return;
  }
  img.data.set([(color >>> 16) & 0xff, (color >>> 8) & 0xff, color & 0xff, 255], o);
}

/** Alpha-over, nearest-neighbor integer scale. Source alpha is 0 or 255. */
export function blit(dst: Rgba, src: Rgba, dx: number, dy: number, scale = 1): void {
  for (let y = 0; y < src.height * scale; y += 1) {
    for (let x = 0; x < src.width * scale; x += 1) {
      const c = getPixel(src, Math.floor(x / scale), Math.floor(y / scale));
      if (c >= 0) setPixel(dst, dx + x, dy + y, c);
    }
  }
}

export function scaleImage(src: Rgba, scale: number): Rgba {
  const out = createImage(src.width * scale, src.height * scale);
  blit(out, src, 0, 0, scale);
  return out;
}

export interface Stats {
  colors: number;
  alphaClean: boolean;
  opaqueBox: { x: number; y: number; w: number; h: number } | null;
  /** Opaque pixels with no 4-neighbor of the same color. */
  loose: number;
}

export function stats(img: Rgba): Stats {
  const colors = new Set<number>();
  let alphaClean = true;
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  let loose = 0;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const a = img.data[(y * img.width + x) * 4 + 3]!;
      if (a !== 0 && a !== 255) alphaClean = false;
      const c = getPixel(img, x, y);
      if (c < 0) continue;
      colors.add(c);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const same = [getPixel(img, x + 1, y), getPixel(img, x - 1, y), getPixel(img, x, y + 1), getPixel(img, x, y - 1)];
      if (!same.includes(c)) loose += 1;
    }
  }
  return {
    colors: colors.size,
    alphaClean,
    opaqueBox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    loose,
  };
}
