/**
 * generate-hdr-white.mjs — emit a small set of HDR PNGs in
 * `site/public/`, each a uniform white at a different PQ peak
 * level. They carry HDR colorspace metadata (BT.2100 / PQ / full
 * range) via the `cICP` chunk introduced in PNG 3rd edition.
 *
 * PQ encoding is perceptual: 0.5 ≈ 92 nits (around SDR peak),
 * 0.75 ≈ 290 nits, 0.85 ≈ 750 nits, 1.0 ≈ 10 000 nits. So picking
 * progressively lower PQ values gives progressively dimmer HDR
 * brightness — exactly the dial we need to attenuate the photophobia
 * wash on more-saturated background tiers without falling back to
 * `opacity` (which can cause weird HDR tone-mapping).
 *
 * On Chrome ≥ 122 + Apple XDR (or any HDR-capable display + browser
 * that honours PNG cICP), the files paint *above SDR peak* on an
 * element with `dynamic-range-limit: no-limit`. SDR displays
 * tone-map back to a normal white.
 *
 * Run once after editing this file (or to regenerate the assets):
 *   node site/scripts/generate-hdr-white.mjs
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const W = 4
const H = 4

// One file per HDR-affected bg tier. PQ is perceptual:
// 180 ≈ 0.57, 260 ≈ 0.61, 950 ≈ 0.75, 2 000 ≈ 0.83, 10 000 ≈ 1.00.
// Wider gaps between block and pane reduce tone-mapping anomalies
// on SDR displays — Chrome's PQ curve isn't always monotonic across
// narrow bands, so a 3.5× luminance ratio between adjacent tiers
// makes the order robust through any SDR roll-off.
const TIERS = [
  { name: 'hdr-white-section', pq: 1.00 },  // 10 000 nits
  { name: 'hdr-white-base',    pq: 0.83 },  //  2 000 nits
  { name: 'hdr-white-pane',    pq: 0.75 },  //    950 nits
  { name: 'hdr-white-block',   pq: 0.61 },  //    260 nits
  { name: 'hdr-white-spot',    pq: 0.57 },  //    180 nits
]

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length, 0)
  const tb = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0)
  return Buffer.concat([length, tb, data, crcBuf])
}

// IHDR: width, height, 16-bit depth, RGB (color type 2 — no alpha,
// since each image is a uniform white), no interlace / no special
// compression.
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 16
ihdr[9] = 2
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

// cICP: colour primaries 9 (BT.2100), transfer 16 (PQ), matrix 0
// (identity / RGB), full-range flag 1.
const cicp = Buffer.from([9, 16, 0, 1])

for (const tier of TIERS) {
  const value = Math.round(tier.pq * 0xffff)
  const scanlineBytes = 1 + W * 6
  const raw = Buffer.alloc(H * scanlineBytes)
  let off = 0
  for (let y = 0; y < H; y++) {
    raw[off++] = 0
    for (let x = 0; x < W; x++) {
      raw.writeUInt16BE(value, off); off += 2  // R
      raw.writeUInt16BE(value, off); off += 2  // G
      raw.writeUInt16BE(value, off); off += 2  // B
    }
  }
  const idat = deflateSync(raw, { level: 9 })
  const png = Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('cICP', cicp),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
  const outUrl = new URL(`../public/${tier.name}.png`, import.meta.url)
  writeFileSync(outUrl, png)
  console.log(`wrote ${tier.name}.png (${png.length} bytes, PQ ${tier.pq.toFixed(2)})`)
}
